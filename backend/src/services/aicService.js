import { env } from '../config/env.js';
import { ExternalServiceError } from '../errors/AppError.js';

// Integração com a API pública do Art Institute of Chicago (D2).
// O resto do sistema nunca vê o JSON deles: tudo sai daqui normalizado (tarefa 38).
// Docs da API: https://api.artic.edu/docs/

const FIELDS = 'id,title,artist_display,date_display,medium_display,dimensions,description,image_id,is_public_domain';
const SEARCH_LIMIT = 12;
const TIMEOUT_MS = 5000; // tarefa 39: sem timeout, uma API lenta prende a requisição
const IMAGE_TIMEOUT_MS = 10000;
const IMAGE_MAX_BYTES = 2 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png']);
const DEFAULT_IIIF_URL = 'https://www.artic.edu/iiif/2';

// Cache simples em memória: 10 minutos, com teto de entradas para não crescer sem fim.
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 200;
const cache = new Map();

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() > hit.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return hit.value;
}

function cacheSet(key, value) {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    cache.delete(cache.keys().next().value); // o Map guarda a ordem de inserção: sai o mais antigo
  }
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

// Só para os testes.
export function clearCatalogCache() {
  cache.clear();
}

const headers = () => ({
  Accept: 'application/json',
  // A AIC pede um header identificando quem consome a API.
  'AIC-User-Agent': `casa-de-leiloes (${env.aicContact})`,
});

// Qualquer falha (rede, timeout, status fora de 2xx, JSON inválido) vira o mesmo 502 amigável.
// O detalhe vai para o log do servidor, não para o cliente.
async function getJson(path, params) {
  const url = new URL(`${env.aicBaseUrl}${path}`);
  url.search = new URLSearchParams(params).toString(); // codifica os colchetes de query[term][...]
  let res;
  try {
    res = await fetch(url, { headers: headers(), signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) {
    console.error('[AIC] falha de rede ou timeout:', err.message);
    throw new ExternalServiceError();
  }
  if (res.status === 404) return null;
  if (!res.ok) {
    console.error('[AIC] status inesperado:', res.status);
    throw new ExternalServiceError();
  }
  try {
    return await res.json();
  } catch (err) {
    console.error('[AIC] resposta não é JSON:', err.message);
    throw new ExternalServiceError();
  }
}

const text = (value) => {
  if (typeof value !== 'string') return null;
  const clean = value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return clean || null;
};

function iiifBase(config) {
  const url = config?.iiif_url;
  return typeof url === 'string' && /^https?:\/\//.test(url) ? url.replace(/\/+$/, '') : DEFAULT_IIIF_URL;
}

// Item sem imagem ou que não é de domínio público não serve para lote.
function normalize(item, config) {
  if (!item || item.is_public_domain !== true || !item.image_id) return null;
  return {
    externalId: String(item.id),
    title: text(item.title) ?? 'Sem título',
    artist: text(item.artist_display),
    dateDisplay: text(item.date_display),
    medium: text(item.medium_display),
    dimensions: text(item.dimensions),
    description: text(item.description),
    imageUrl: `${iiifBase(config)}/${encodeURIComponent(item.image_id)}/full/843,/0/default.jpg`,
  };
}

export async function searchArtworks(q) {
  const key = `search:${q.toLowerCase()}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const body = await getJson('/artworks/search', {
    q,
    'query[term][is_public_domain]': 'true',
    fields: FIELDS,
    limit: String(SEARCH_LIMIT),
  });
  if (!body || !Array.isArray(body.data)) {
    console.error('[AIC] busca sem campo data');
    throw new ExternalServiceError();
  }
  const items = body.data.map((item) => normalize(item, body.config)).filter(Boolean);
  cacheSet(key, items);
  return items;
}

// Devolve null se o item não existe, não é de domínio público ou não tem imagem.
export async function getArtwork(externalId) {
  const key = `artwork:${externalId}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const body = await getJson(`/artworks/${encodeURIComponent(externalId)}`, { fields: FIELDS });
  const artwork = body ? normalize(body.data, body.config) : null;
  if (artwork) cacheSet(key, artwork);
  return artwork;
}

// Baixa a imagem para gravar no banco (tarefa 41). Confere tipo e tamanho antes de aceitar.
export async function downloadImage(imageUrl) {
  let res;
  try {
    // O servidor de imagens (IIIF) fica atrás de uma proteção contra robôs que recusa (403) pedidos
    // sem identificação. Vai o mesmo AIC-User-Agent da API, mais um User-Agent com contato.
    res = await fetch(imageUrl, {
      headers: {
        Accept: 'image/jpeg,image/png',
        'User-Agent': `casa-de-leiloes/1.0 (${env.aicContact})`,
        'AIC-User-Agent': `casa-de-leiloes (${env.aicContact})`,
      },
      signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
    });
  } catch (err) {
    console.error('[AIC] falha ao baixar imagem:', err.message);
    throw new ExternalServiceError();
  }
  if (!res.ok) {
    console.error('[AIC] imagem com status', res.status);
    throw new ExternalServiceError();
  }
  const mimeType = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  if (!IMAGE_TYPES.has(mimeType)) {
    console.error('[AIC] tipo de imagem recusado:', mimeType);
    throw new ExternalServiceError();
  }
  const declared = Number(res.headers.get('content-length'));
  if (declared > IMAGE_MAX_BYTES) {
    console.error('[AIC] imagem grande demais:', declared);
    throw new ExternalServiceError();
  }
  // Lê em pedaços e para no limite: o content-length pode faltar ou mentir.
  const chunks = [];
  let size = 0;
  try {
    for await (const chunk of res.body) {
      size += chunk.length;
      if (size > IMAGE_MAX_BYTES) break;
      chunks.push(chunk);
    }
  } catch (err) {
    console.error('[AIC] falha ao ler imagem:', err.message);
    throw new ExternalServiceError();
  }
  const bytes = Buffer.concat(chunks);
  if (bytes.length === 0 || size > IMAGE_MAX_BYTES) {
    console.error('[AIC] imagem vazia ou grande demais:', bytes.length);
    throw new ExternalServiceError();
  }
  return { mimeType, bytes };
}

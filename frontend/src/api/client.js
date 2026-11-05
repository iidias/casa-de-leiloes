// Cliente HTTP do frontend, reaproveitado do meu projeto anterior (plataforma de ingressos).
// Monta a URL a partir de VITE_API_URL, envia o token quando existe e transforma
// qualquer erro da API num ApiError igual para todas as telas.
// Diferenças deste projeto: o backend responde { error: { code, message, details } },
// toda resposta com serverNow acerta o relógio do servidor, e um 401 com token
// salvo encerra a sessão (token vencido ou de outro banco).

import { syncServerClock } from '../lib/serverClock.js';

const BASE_URL = import.meta.env.VITE_API_URL;

export const TOKEN_STORAGE_KEY = 'auth.token';
export const SESSION_EXPIRED_EVENT = 'auth:expired';

export function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

// status: HTTP (0 = sem conexão). code: o código do backend (BELOW_MINIMUM, LOT_ENDED...).
// details: erros de campo da validação, quando houver.
export class ApiError extends Error {
  constructor(message, status, code, details, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.data = data;
  }
}

export function buildUrl(endpoint) {
  if (/^https?:\/\//i.test(endpoint)) return endpoint;
  return `${String(BASE_URL ?? '').replace(/\/$/, '')}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
}

/**
 * @param {string} endpoint  caminho da API, ex.: '/lots?phase=LIVE'
 * @param {object} [options]
 * @param {string} [options.method]
 * @param {any}    [options.body]   objeto serializado como JSON
 * @param {object} [options.headers]
 * @param {boolean} [options.auth]  false não envia o token (rotas públicas)
 * @param {AbortSignal} [options.signal]
 */
export async function apiFetch(endpoint, options = {}) {
  const { method = 'GET', body, headers = {}, auth = true, ...rest } = options;

  const finalHeaders = { Accept: 'application/json', ...headers };
  const hasBody = body !== undefined && body !== null;
  if (hasBody) finalHeaders['Content-Type'] = 'application/json';

  const token = auth ? getStoredToken() : null;
  if (token) finalHeaders.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(buildUrl(endpoint), {
      ...rest,
      method,
      headers: finalHeaders,
      body: hasBody ? JSON.stringify(body) : undefined,
    });
  } catch (networkError) {
    if (networkError?.name === 'AbortError') throw networkError;
    throw new ApiError(
      'Não foi possível conectar ao servidor. Verifique sua conexão.',
      0,
      'NETWORK_ERROR',
    );
  }

  if (response.status === 204) return null;

  const contentType = response.headers.get('content-type') ?? '';
  const data = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : null;

  if (data && typeof data.serverNow === 'string') syncServerClock(data.serverNow);

  if (!response.ok) {
    const error = data && typeof data.error === 'object' ? data.error : null;
    if (response.status === 401 && token) {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
    throw new ApiError(
      error?.message || 'Erro inesperado. Tente novamente.',
      response.status,
      error?.code ?? 'UNKNOWN',
      error?.details,
      data,
    );
  }

  return data;
}

// Erros de campo da validação ({ field, message }[]) num objeto { campo: mensagem },
// para cada mensagem aparecer embaixo do próprio campo.
export function fieldErrorsFrom(error) {
  const result = {};
  if (Array.isArray(error?.details)) {
    for (const item of error.details) {
      if (item?.field && !result[item.field]) result[item.field] = item.message;
    }
  }
  return result;
}

export const api = {
  get: (endpoint, options) => apiFetch(endpoint, { ...options, method: 'GET' }),
  post: (endpoint, body, options) => apiFetch(endpoint, { ...options, method: 'POST', body }),
  patch: (endpoint, body, options) => apiFetch(endpoint, { ...options, method: 'PATCH', body }),
  delete: (endpoint, options) => apiFetch(endpoint, { ...options, method: 'DELETE' }),
};

export default apiFetch;

import { randomUUID } from 'node:crypto';
import { ConflictError, NotFoundError, ValidationError } from '../errors/AppError.js';
import { genesisHash, headSeal } from '../lib/auditChain.js';
import { lotPhase } from '../lib/lotPhase.js';
import prisma from '../lib/prisma.js';
import { isUuid } from '../validators/lotSchemas.js';
import { downloadImage, getArtwork } from './aicService.js';

// Campos que a vitrine e as listas precisam. NUNCA inclui sellerId, leaderId nem os bytes da imagem.
const CARD_SELECT = {
  id: true,
  title: true,
  artist: true,
  startingPriceCents: true,
  minIncrementCents: true,
  currentPriceCents: true,
  bidCount: true,
  startsAt: true,
  endsAt: true,
  status: true,
};

const DETAIL_SELECT = {
  ...CARD_SELECT,
  dateDisplay: true,
  medium: true,
  dimensions: true,
  description: true,
  originalEndsAt: true,
  leaderId: true, // usado só para achar o apelido; não sai na resposta
};

const imagePath = (lotId) => `/lots/${lotId}/image`;

// Próximo lance aceito (tarefa 46). Sem lances: o próprio lance inicial ("valor mínimo").
// Com lances: lance atual + incremento mínimo.
export function minNextBidCents(lot) {
  return lot.bidCount === 0 ? lot.startingPriceCents : lot.currentPriceCents + lot.minIncrementCents;
}

function toCard(lot, now) {
  return {
    id: lot.id,
    title: lot.title,
    artist: lot.artist,
    imageUrl: imagePath(lot.id),
    startingPriceCents: lot.startingPriceCents,
    currentPriceCents: lot.currentPriceCents,
    bidCount: lot.bidCount,
    startsAt: lot.startsAt,
    endsAt: lot.endsAt,
    phase: lotPhase(lot, now),
  };
}

// ---------- Criação (tarefas 41 a 43) ----------

export async function createLot(sellerId, data) {
  // O item é buscado AQUI, no servidor, pelo id. Título, atributos e imagem nunca vêm do front:
  // senão o leiloeiro poderia criar um lote com qualquer imagem.
  const artwork = await getArtwork(data.externalId);
  if (!artwork) {
    throw new ValidationError('Dados inválidos', [
      { field: 'externalId', message: 'Item não encontrado no catálogo ou sem imagem de domínio público' },
    ]);
  }

  // A imagem é gravada no banco: se a API cair depois, a vitrine continua com foto.
  const image = await downloadImage(artwork.imageUrl);

  const lot = {
    id: randomUUID(), // gerado antes porque entra no hash gênese
    sellerId,
    startingPriceCents: data.startingPriceCents,
    minIncrementCents: data.minIncrementCents,
    startsAt: data.startsAt,
    endsAt: data.endsAt,
    originalEndsAt: data.endsAt,
  };
  const genesis = genesisHash(lot);

  // Escrita aninhada: o Prisma grava lote e imagem na mesma transação.
  const created = await prisma.lot.create({
    data: {
      ...lot,
      externalSource: 'AIC',
      externalId: artwork.externalId,
      title: artwork.title,
      artist: artwork.artist,
      dateDisplay: artwork.dateDisplay,
      medium: artwork.medium,
      dimensions: artwork.dimensions,
      // A descrição do lote é do leiloeiro. A da API (licença CC BY) não é copiada.
      description: data.description || null,
      headHash: genesis,
      headSeal: headSeal(lot.id, 0, genesis),
      image: { create: { mimeType: image.mimeType, bytes: image.bytes } },
    },
    select: DETAIL_SELECT,
  });

  return toSellerLot(created, new Date());
}

// ---------- Público (tarefas 45 e 46) ----------

// Filtro de fase feito no SQL, com o mesmo critério do lotPhase.
function phaseWhere(phase, now) {
  switch (phase) {
    case 'SCHEDULED':
      return { status: 'ACTIVE', startsAt: { gt: now } };
    case 'LIVE':
      return { status: 'ACTIVE', startsAt: { lte: now }, endsAt: { gt: now } };
    case 'ENDED':
      return { OR: [{ status: 'SETTLED' }, { status: 'ACTIVE', endsAt: { lte: now } }] };
    default:
      return { status: { not: 'CANCELLED' } };
  }
}

const PHASE_ORDER = {
  LIVE: [{ endsAt: 'asc' }], // termina antes, aparece antes
  SCHEDULED: [{ startsAt: 'asc' }],
  ENDED: [{ endsAt: 'desc' }],
};

export async function listLots(phase) {
  const now = new Date();
  const lots = await prisma.lot.findMany({
    where: phaseWhere(phase, now),
    select: CARD_SELECT,
    orderBy: PHASE_ORDER[phase] ?? [{ endsAt: 'asc' }],
    take: 100,
  });
  return { serverNow: now, lots: lots.map((lot) => toCard(lot, now)) };
}

async function leaderAlias(lot) {
  if (!lot.leaderId) return null;
  const participant = await prisma.lotParticipant.findUnique({
    where: { lotId_userId: { lotId: lot.id, userId: lot.leaderId } },
    select: { alias: true },
  });
  return participant ? `Licitante #${participant.alias}` : null;
}

// Lote cancelado responde 404, igual a "não existe": ele some da vitrine e também da URL direta.
export async function getPublicLot(id) {
  if (!isUuid(id)) throw new NotFoundError('Lote não encontrado');
  const lot = await prisma.lot.findFirst({
    where: { id, status: { not: 'CANCELLED' } },
    select: DETAIL_SELECT,
  });
  if (!lot) throw new NotFoundError('Lote não encontrado');

  const now = new Date();
  return {
    serverNow: now,
    lot: {
      ...toCard(lot, now),
      dateDisplay: lot.dateDisplay,
      medium: lot.medium,
      dimensions: lot.dimensions,
      description: lot.description,
      minIncrementCents: lot.minIncrementCents,
      minNextBidCents: minNextBidCents(lot),
      originalEndsAt: lot.originalEndsAt,
      leaderAlias: await leaderAlias(lot),
    },
  };
}

export async function getLotImage(id) {
  if (!isUuid(id)) throw new NotFoundError('Imagem não encontrada');
  const image = await prisma.lotImage.findFirst({
    where: { lotId: id, lot: { status: { not: 'CANCELLED' } } },
    select: { mimeType: true, bytes: true },
  });
  if (!image) throw new NotFoundError('Imagem não encontrada');
  return { mimeType: image.mimeType, bytes: Buffer.from(image.bytes) };
}

// ---------- Leiloeiro (tarefas 47 e 48) ----------

function toSellerLot(lot, now) {
  const phase = lotPhase(lot, now);
  return {
    id: lot.id,
    title: lot.title,
    artist: lot.artist,
    dateDisplay: lot.dateDisplay,
    medium: lot.medium,
    dimensions: lot.dimensions,
    description: lot.description,
    // A imagem pública responde 404 para cancelado; o painel mostra o cancelado sem foto.
    imageUrl: phase === 'CANCELLED' ? null : imagePath(lot.id),
    startingPriceCents: lot.startingPriceCents,
    minIncrementCents: lot.minIncrementCents,
    currentPriceCents: lot.currentPriceCents,
    bidCount: lot.bidCount,
    startsAt: lot.startsAt,
    endsAt: lot.endsAt,
    originalEndsAt: lot.originalEndsAt,
    phase,
    canCancel: lot.status === 'ACTIVE' && lot.bidCount === 0 && now < lot.endsAt,
  };
}

export async function listSellerLots(sellerId) {
  const now = new Date();
  const lots = await prisma.lot.findMany({
    where: { sellerId },
    select: DETAIL_SELECT,
    orderBy: { createdAt: 'desc' },
  });
  return { serverNow: now, lots: lots.map((lot) => toSellerLot(lot, now)) };
}

// Lote de outro leiloeiro → 404, nunca 403 (o 403 confirmaria que o lote existe).
export async function getSellerLot(sellerId, id) {
  if (!isUuid(id)) throw new NotFoundError('Lote não encontrado');
  const lot = await prisma.lot.findFirst({ where: { id, sellerId }, select: DETAIL_SELECT });
  if (!lot) throw new NotFoundError('Lote não encontrado');
  const now = new Date();
  return { serverNow: now, lot: toSellerLot(lot, now) };
}

// Cancelar só sem lances (tarefa 48). A condição fica DENTRO do UPDATE: se o primeiro lance
// chegar no mesmo instante, o lance trava a linha do lote e incrementa bidCount na mesma
// transação, então um dos dois sempre perde corretamente.
export async function cancelLot(sellerId, id) {
  if (!isUuid(id)) throw new NotFoundError('Lote não encontrado');
  const now = new Date();
  const result = await prisma.lot.updateMany({
    where: { id, sellerId, status: 'ACTIVE', bidCount: 0, endsAt: { gt: now } },
    data: { status: 'CANCELLED' },
  });

  if (result.count === 0) {
    // Descobrir o motivo, sem revelar nada de lote alheio.
    const lot = await prisma.lot.findFirst({ where: { id, sellerId }, select: { status: true, bidCount: true } });
    if (!lot) throw new NotFoundError('Lote não encontrado');
    if (lot.status === 'CANCELLED') throw new ConflictError('Este lote já foi cancelado', 'LOT_ALREADY_CANCELLED');
    if (lot.bidCount > 0) throw new ConflictError('Não é possível cancelar: o lote já recebeu lances', 'LOT_HAS_BIDS');
    throw new ConflictError('Não é possível cancelar: o lote já foi encerrado', 'LOT_ALREADY_ENDED');
  }

  return getSellerLot(sellerId, id);
}

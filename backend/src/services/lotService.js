import { randomUUID } from 'node:crypto';
import { ConflictError, NotFoundError, ValidationError } from '../errors/AppError.js';
import { genesisHash, headSeal } from '../lib/auditChain.js';
import { publish } from '../lib/events.js';
import { lotPhase } from '../lib/lotPhase.js';
import prisma from '../lib/prisma.js';
import { isUuid } from '../validators/lotSchemas.js';
import { downloadImage, getArtwork } from './aicService.js';
import { settleDueLots, settleIfDue } from './settlementService.js';

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
  winnerId: true, // idem
  finalPriceCents: true,
  settledAt: true,
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

  return createLotFromArtwork(sellerId, data, artwork, image);
}

// Grava o lote a partir de uma obra já normalizada e da imagem já baixada.
// Separado do createLot para o seed criar lotes sem depender da API externa (tarefa 78).
export async function createLotFromArtwork(sellerId, data, artwork, image) {
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
  await settleDueLots(); // liquidação preguiçosa (tarefa 68)
  const now = new Date();
  const lots = await prisma.lot.findMany({
    where: phaseWhere(phase, now),
    select: CARD_SELECT,
    orderBy: PHASE_ORDER[phase] ?? [{ endsAt: 'asc' }],
    take: 100,
  });
  return { serverNow: now, lots: lots.map((lot) => toCard(lot, now)) };
}

async function aliasOf(lotId, userId) {
  if (!userId) return null;
  const participant = await prisma.lotParticipant.findUnique({
    where: { lotId_userId: { lotId, userId } },
    select: { alias: true },
  });
  return participant ? `Licitante #${participant.alias}` : null;
}

// Resultado de um lote encerrado: arrematado (por quem, por apelido, e por quanto) ou sem lances.
// Lote vencido que ainda não foi liquidado aparece como pendente.
async function resultOf(lot, phase) {
  if (phase !== 'ENDED') return null;
  if (lot.status !== 'SETTLED') return { settled: false };
  if (!lot.winnerId) return { settled: true, sold: false, settledAt: lot.settledAt };
  return {
    settled: true,
    sold: true,
    winnerAlias: await aliasOf(lot.id, lot.winnerId),
    finalPriceCents: lot.finalPriceCents,
    settledAt: lot.settledAt,
  };
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
  await settleIfDue(id); // liquidação preguiçosa (tarefa 68)
  const lot = await prisma.lot.findFirst({
    where: { id, status: { not: 'CANCELLED' } },
    select: DETAIL_SELECT,
  });
  if (!lot) throw new NotFoundError('Lote não encontrado');

  // Histórico da sala (PDF, pág. 3): apelido, valor e horário. Nunca quem é a pessoa.
  const history = await prisma.bid.findMany({
    where: { lotId: lot.id },
    orderBy: { seq: 'desc' },
    select: { seq: true, alias: true, amountCents: true, createdAt: true },
  });

  const now = new Date();
  const phase = lotPhase(lot, now);
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
      result: await resultOf(lot, phase),
      bids: history.map((b) => ({ seq: b.seq, alias: `Licitante #${b.alias}`, amountCents: b.amountCents, createdAt: b.createdAt })),
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

async function toSellerLot(lot, now) {
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
    result: await resultOf(lot, phase),
  };
}

export async function listSellerLots(sellerId) {
  await settleDueLots();
  const now = new Date();
  const lots = await prisma.lot.findMany({
    where: { sellerId },
    select: DETAIL_SELECT,
    orderBy: { createdAt: 'desc' },
  });
  return { serverNow: now, lots: await Promise.all(lots.map((lot) => toSellerLot(lot, now))) };
}

// Lote de outro leiloeiro → 404, nunca 403 (o 403 confirmaria que o lote existe).
export async function getSellerLot(sellerId, id) {
  if (!isUuid(id)) throw new NotFoundError('Lote não encontrado');
  await settleIfDue(id);
  const lot = await prisma.lot.findFirst({ where: { id, sellerId }, select: DETAIL_SELECT });
  if (!lot) throw new NotFoundError('Lote não encontrado');
  const now = new Date();
  return { serverNow: now, lot: await toSellerLot(lot, now) };
}

// Resumo do leiloeiro (tarefa 74; PDF, pág. 3): resultado de cada lote encerrado
// (arrematado? por quanto?) e o total recebido.
// O total vem do EXTRATO (créditos de arremate), não da soma dos lotes: se um dia existir
// estorno, o número continua certo.
export async function getSellerSummary(sellerId) {
  await settleDueLots();
  const [lots, credit] = await Promise.all([
    prisma.lot.findMany({
      where: { sellerId, status: 'SETTLED' },
      select: { id: true, title: true, winnerId: true, finalPriceCents: true, settledAt: true },
      orderBy: { settledAt: 'desc' },
    }),
    prisma.ledgerEntry.aggregate({
      where: { type: 'SETTLEMENT_CREDIT', wallet: { userId: sellerId } },
      _sum: { amountCents: true },
    }),
  ]);
  return {
    serverNow: new Date(),
    totalReceivedCents: credit._sum.amountCents ?? 0,
    soldCount: lots.filter((l) => l.winnerId).length,
    endedLots: await Promise.all(
      lots.map(async (l) => ({
        id: l.id,
        title: l.title,
        imageUrl: imagePath(l.id),
        sold: Boolean(l.winnerId),
        finalPriceCents: l.finalPriceCents,
        winnerAlias: await aliasOf(l.id, l.winnerId),
        settledAt: l.settledAt,
      })),
    ),
  };
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

  publish(id.toLowerCase(), 'cancelled', { lotId: id.toLowerCase() }); // quem está na sala vê o lote sair
  return getSellerLot(sellerId, id);
}

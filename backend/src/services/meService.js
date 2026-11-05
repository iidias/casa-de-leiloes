import { NotFoundError } from '../errors/AppError.js';
import { lotPhase } from '../lib/lotPhase.js';
import prisma from '../lib/prisma.js';
import { generateLinkId, shareUrlFor, verifyShareToken } from '../lib/receiptLink.js';
import { receiptNumber, receiptSignatureValid } from '../lib/receiptSignature.js';
import { isUuid } from '../validators/lotSchemas.js';
import { minNextBidCents } from './lotService.js';
import { settleDueLots, settleIfDue } from './settlementService.js';

// Rotas do licitante (tarefas 71, 72 e 76) e comprovante público (tarefa 73).

const imagePath = (lotId) => `/lots/${lotId}/image`;
const aliasLabel = (alias) => (alias ? `Licitante #${alias}` : null);

// Posição do usuário nos lances (PDF, pág. 3; decisão na seção 1.14 do plano):
// ranking pelo MAIOR lance de cada licitante no lote. 1º = líder.
async function standingIn(lotId, userId) {
  const best = await prisma.bid.groupBy({
    by: ['bidderId'],
    where: { lotId },
    _max: { amountCents: true },
  });
  const mine = best.find((b) => b.bidderId === userId)?._max.amountCents ?? null;
  if (mine === null) return { myBestBidCents: null, position: null, totalBidders: best.length };
  const position = 1 + best.filter((b) => b._max.amountCents > mine).length;
  return { myBestBidCents: mine, position, totalBidders: best.length };
}

// GET /lots/:id/me (tarefa 76): meu apelido, minha posição e se estou ganhando.
export async function getMyStanding(lotId, userId) {
  if (!isUuid(lotId)) throw new NotFoundError('Lote não encontrado');
  await settleIfDue(lotId);
  const lot = await prisma.lot.findFirst({
    where: { id: lotId, status: { not: 'CANCELLED' } },
    select: { id: true, status: true, startsAt: true, endsAt: true, leaderId: true, winnerId: true },
  });
  if (!lot) throw new NotFoundError('Lote não encontrado');
  const participant = await prisma.lotParticipant.findUnique({
    where: { lotId_userId: { lotId: lot.id, userId } },
    select: { alias: true },
  });
  const now = new Date();
  if (!participant) return { serverNow: now, alias: null, myBestBidCents: null, position: null, totalBidders: null, isLeading: false, won: false };
  return {
    serverNow: now,
    alias: aliasLabel(participant.alias),
    ...(await standingIn(lot.id, userId)),
    isLeading: lot.leaderId === userId,
    won: lot.status === 'SETTLED' && lot.winnerId === userId,
    phase: lotPhase(lot, now),
  };
}

// GET /me/bids (tarefa 71): lotes em que dei lance (Meus arremates, "em andamento" e encerrados).
export async function listMyBids(userId) {
  await settleDueLots();
  const participations = await prisma.lotParticipant.findMany({
    where: { userId, lot: { status: { not: 'CANCELLED' } } },
    select: {
      alias: true,
      lot: {
        select: {
          id: true, title: true, artist: true, status: true, startsAt: true, endsAt: true, bidCount: true,
          currentPriceCents: true, startingPriceCents: true, minIncrementCents: true, leaderId: true, winnerId: true,
          finalPriceCents: true, settledAt: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  const now = new Date();
  const items = await Promise.all(
    participations.map(async ({ alias, lot }) => {
      const phase = lotPhase(lot, now);
      return {
        lot: {
          id: lot.id,
          title: lot.title,
          artist: lot.artist,
          imageUrl: imagePath(lot.id),
          phase,
          endsAt: lot.endsAt,
          currentPriceCents: lot.currentPriceCents,
          minNextBidCents: phase === 'LIVE' ? minNextBidCents(lot) : null,
          bidCount: lot.bidCount,
        },
        alias: aliasLabel(alias),
        ...(await standingIn(lot.id, userId)),
        isLeading: lot.leaderId === userId && phase !== 'ENDED',
        won: lot.status === 'SETTLED' && lot.winnerId === userId,
        lost: phase === 'ENDED' && lot.status === 'SETTLED' && lot.winnerId !== userId,
      };
    }),
  );
  return { serverNow: now, items };
}

function receiptView(r) {
  return {
    id: r.id,
    number: receiptNumber(r.signature),
    lot: { id: r.lot.id, title: r.lot.title, artist: r.lot.artist, imageUrl: imagePath(r.lot.id) },
    amountCents: r.amountCents,
    issuedAt: r.issuedAt,
    finalChainHash: r.finalChainHash,
    // O link fica SEMPRE visível para o dono (PDF: Meus arremates mostra o comprovante e o link).
    // É remontado a partir do linkId: a tag não está no banco. Só aparece nesta rota autenticada.
    shareUrl: r.linkId ? shareUrlFor(r.linkId) : null,
  };
}

const RECEIPT_SELECT = {
  id: true, amountCents: true, issuedAt: true, finalChainHash: true, signature: true, linkId: true,
  lot: { select: { id: true, title: true, artist: true } },
};

// GET /me/wins (tarefa 71): lotes vencidos, com comprovante e link.
export async function listMyWins(userId) {
  await settleDueLots();
  const receipts = await prisma.receipt.findMany({
    where: { winnerId: userId },
    select: RECEIPT_SELECT,
    orderBy: { issuedAt: 'desc' },
  });
  return { serverNow: new Date(), wins: receipts.map(receiptView) };
}

// GET /me/receipts/:id (tarefa 71). Comprovante de outra pessoa → 404, igual a "não existe"
// (o mesmo cuidado do getOwnedTicket do projeto anterior, que a Verzel elogiou).
export async function getMyReceipt(userId, id) {
  if (!isUuid(id)) throw new NotFoundError('Comprovante não encontrado');
  const receipt = await prisma.receipt.findFirst({ where: { id, winnerId: userId }, select: RECEIPT_SELECT });
  if (!receipt) throw new NotFoundError('Comprovante não encontrado');
  return { receipt: receiptView(receipt) };
}

// POST /me/receipts/:id/share-link (tarefa 72): gera um link novo e o anterior para de funcionar na hora.
export async function rotateShareLink(userId, id) {
  if (!isUuid(id)) throw new NotFoundError('Comprovante não encontrado');
  const linkId = generateLinkId();
  const updated = await prisma.receipt.updateMany({ where: { id, winnerId: userId }, data: { linkId } });
  if (updated.count === 0) throw new NotFoundError('Comprovante não encontrado');
  return { shareUrl: shareUrlFor(linkId) };
}

// GET /public/receipts/:token (tarefa 73). Sem login.
// Forjado, revogado ou inexistente: a MESMA resposta 404. Link forjado nem chega ao banco.
// Entra só o essencial. Não entra: nome, e-mail ou id do vencedor; id ou nome do leiloeiro;
// id interno do comprovante; o próprio link; saldo de ninguém.
export async function getPublicReceipt(token) {
  const check = verifyShareToken(token);
  if (!check.ok) throw new NotFoundError('Comprovante não encontrado');

  const receipt = await prisma.receipt.findUnique({
    where: { linkId: check.linkId },
    select: {
      id: true, lotId: true, winnerId: true, amountCents: true, issuedAt: true, finalChainHash: true, signature: true,
      lot: { select: { id: true, title: true, artist: true, headHash: true } },
    },
  });
  if (!receipt) throw new NotFoundError('Comprovante não encontrado');

  const participant = await prisma.lotParticipant.findUnique({
    where: { lotId_userId: { lotId: receipt.lotId, userId: receipt.winnerId } },
    select: { alias: true },
  });
  const signatureValid = Boolean(participant) && receiptSignatureValid(
    {
      id: receipt.id,
      lotId: receipt.lotId,
      title: receipt.lot.title,
      winnerAlias: participant.alias,
      amountCents: receipt.amountCents,
      issuedAt: receipt.issuedAt,
      finalChainHash: receipt.finalChainHash,
    },
    receipt.signature,
  );

  return {
    receipt: {
      number: receiptNumber(receipt.signature),
      lot: { id: receipt.lot.id, title: receipt.lot.title, artist: receipt.lot.artist, imageUrl: imagePath(receipt.lot.id) },
      winnerAlias: aliasLabel(participant?.alias),
      amountCents: receipt.amountCents,
      settledAt: receipt.issuedAt,
      finalChainHash: receipt.finalChainHash,
      signatureValid,
      // O último hash da cadeia hoje ainda é o do encerramento? Se não, o histórico mudou depois.
      chainMatches: receipt.lot.headHash === receipt.finalChainHash,
      auditUrl: `/lots/${receipt.lot.id}/audit`,
    },
  };
}

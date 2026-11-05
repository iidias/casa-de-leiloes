import { NotFoundError } from '../errors/AppError.js';
import { verifyChain } from '../lib/auditChain.js';
import { lotPhase } from '../lib/lotPhase.js';
import prisma from '../lib/prisma.js';
import { isUuid } from '../validators/lotSchemas.js';
import { settleIfDue } from './settlementService.js';

// Auditoria pública (tarefa 64): sem login. Lote cancelado → 404, igual a "não existe".
// Devolve o histórico completo e o resultado da verificação feita no servidor.
// Nunca devolve selos, bidderId, userId, sellerId nem qualquer dado pessoal.
export async function getLotAudit(id) {
  if (!isUuid(id)) throw new NotFoundError('Lote não encontrado');
  await settleIfDue(id); // liquidação preguiçosa (tarefa 68)

  // Lote, lances e participantes lidos num mesmo instantâneo do banco: um lance que chegue
  // no meio da leitura não faz um histórico íntegro parecer adulterado.
  const [lot, bids, participants, receipt, checkedAt] = await prisma.$transaction(
    [
      prisma.lot.findFirst({ where: { id, status: { not: 'CANCELLED' } } }),
      prisma.bid.findMany({ where: { lotId: id }, orderBy: { seq: 'asc' } }),
      prisma.lotParticipant.findMany({ where: { lotId: id } }),
      prisma.receipt.findUnique({ where: { lotId: id } }),
      prisma.$queryRaw`SELECT now() AS "checkedAt"`,
    ],
    { isolationLevel: 'RepeatableRead' },
  );
  if (!lot) throw new NotFoundError('Lote não encontrado');

  const { genesis, problems } = verifyChain(lot, bids, participants, receipt);
  const now = new Date();

  return {
    lot: {
      id: lot.id,
      title: lot.title,
      startingPriceCents: lot.startingPriceCents,
      minIncrementCents: lot.minIncrementCents,
      startsAt: lot.startsAt,
      originalEndsAt: lot.originalEndsAt,
      endsAt: lot.endsAt,
      phase: lotPhase(lot, now),
    },
    genesisHash: genesis,
    bids: bids.map((b) => ({
      seq: b.seq,
      alias: b.alias, // número; a tela mostra "Licitante #N". É o mesmo valor que entra no hash.
      amountCents: b.amountCents,
      createdAt: b.createdAt,
      endsAtAfter: b.endsAtAfter,
      prevHash: b.prevHash,
      hash: b.hash,
    })),
    integrity: { ok: problems.length === 0, checkedAt: checkedAt[0].checkedAt, problems },
    serverNow: now,
  };
}

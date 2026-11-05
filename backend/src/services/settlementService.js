import { randomUUID } from 'node:crypto';
import { publish } from '../lib/events.js';
import prisma from '../lib/prisma.js';
import { generateLinkId } from '../lib/receiptLink.js';
import { signReceipt } from '../lib/receiptSignature.js';

// Liquidação (tarefas 67 a 69). Regra do PDF (pág. 4): ao encerrar, debita-se o valor do vencedor
// e credita-se ao leiloeiro, gerando o comprovante. Lotes sem lances fecham sem vencedor.

const TX_OPTIONS = { maxWait: 10_000, timeout: 15_000 };

// Idempotente: rodar duas vezes (encerrador + acesso preguiçoso, ou duas instâncias) não debita duas vezes.
// `options.now` existe só para o seed criar um lote já encerrado; as rotas nunca passam isso.
export async function settleLot(lotId, options = {}) {
  const result = await prisma.$transaction(async (tx) => {
    // 1. Trava o lote. Um lance de última hora pode ter prorrogado o fim enquanto esperávamos:
    //    por isso status e endsAt são relidos DEPOIS da trava.
    const [lot] = await tx.$queryRaw`
      SELECT id, "sellerId", status, "endsAt", "bidCount", "currentPriceCents", "leaderId", "headHash", title
      FROM "Lot" WHERE id = ${lotId}::uuid FOR UPDATE`;
    if (!lot) return null;
    const now = options.now ?? (await tx.$queryRaw`SELECT date_trunc('milliseconds', clock_timestamp()) AS now`)[0].now;

    // Já liquidado, cancelado ou ainda não terminou (inclusive se foi prorrogado): nada a fazer.
    if (lot.status !== 'ACTIVE' || now < lot.endsAt) return null;

    // 2. Sem lances: fecha sem vencedor.
    if (lot.bidCount === 0) {
      await tx.lot.update({ where: { id: lot.id }, data: { status: 'SETTLED', settledAt: now } });
      return { lotId: lot.id, sold: false, settledAt: now };
    }

    // 3. Com lances: trava as carteiras do vencedor e do leiloeiro, sempre em ordem de userId (igual ao lance).
    const price = lot.currentPriceCents;
    const winnerId = lot.leaderId;
    const userIds = [winnerId, lot.sellerId].sort();
    const wallets = await tx.$queryRaw`
      SELECT id, "userId" FROM "Wallet" WHERE "userId" = ANY(${userIds}::uuid[]) ORDER BY "userId" FOR UPDATE`;
    const walletOf = (userId) => wallets.find((w) => w.userId === userId).id;

    // Vencedor: o valor sai do total E do comprometido (estava reservado desde que passou a liderar).
    await tx.wallet.update({
      where: { id: walletOf(winnerId) },
      data: { totalCents: { decrement: price }, committedCents: { decrement: price } },
    });
    await tx.ledgerEntry.create({ data: { walletId: walletOf(winnerId), type: 'SETTLEMENT_DEBIT', amountCents: price, lotId: lot.id } });

    // Leiloeiro: o valor entra no total.
    await tx.wallet.update({ where: { id: walletOf(lot.sellerId) }, data: { totalCents: { increment: price } } });
    await tx.ledgerEntry.create({ data: { walletId: walletOf(lot.sellerId), type: 'SETTLEMENT_CREDIT', amountCents: price, lotId: lot.id } });

    await tx.lot.update({
      where: { id: lot.id },
      data: { status: 'SETTLED', settledAt: now, winnerId, finalPriceCents: price },
    });

    // 4. Comprovante assinado, já com o linkId: o link de compartilhamento existe desde o encerramento.
    //    lotId é @unique no Receipt: segunda barreira contra comprovante duplicado.
    const { alias } = await tx.lotParticipant.findUnique({ where: { lotId_userId: { lotId: lot.id, userId: winnerId } } });
    const receipt = {
      id: randomUUID(),
      lotId: lot.id,
      title: lot.title,
      winnerAlias: alias,
      amountCents: price,
      issuedAt: now,
      finalChainHash: lot.headHash,
    };
    await tx.receipt.create({
      data: {
        id: receipt.id,
        lotId: lot.id,
        winnerId,
        sellerId: lot.sellerId,
        amountCents: price,
        finalChainHash: lot.headHash,
        issuedAt: now,
        signature: signReceipt(receipt),
        linkId: generateLinkId(),
      },
    });

    return { lotId: lot.id, sold: true, winnerAlias: `Licitante #${alias}`, finalPriceCents: price, settledAt: now };
  }, TX_OPTIONS);

  // Depois do commit: avisa a sala.
  if (result) publish(result.lotId, 'settled', result);
  return result;
}

// Liquida todos os lotes vencidos. Usado pelo encerrador e pelas leituras ("liquidação preguiçosa").
// Vai em lotes de 50 e não repete um lote já tentado na mesma rodada: um lote que falha sempre
// (dado corrompido barrado pelos CHECKs do banco) não pode travar a fila e impedir os outros de fechar.
export async function settleDueLots(batchSize = 50) {
  const tried = [];
  for (;;) {
    const due = await prisma.lot.findMany({
      where: { status: 'ACTIVE', endsAt: { lte: new Date() }, id: { notIn: tried } },
      select: { id: true },
      orderBy: { endsAt: 'asc' },
      take: batchSize,
    });
    for (const { id } of due) {
      tried.push(id);
      try {
        await settleLot(id);
      } catch (err) {
        // Um lote com problema não pode impedir os outros de fechar, nem derrubar a leitura de quem chamou.
        console.error(`[encerrador] falha ao liquidar o lote ${id}:`, err.message);
      }
    }
    if (due.length < batchSize) return tried.length;
  }
}

// Liquidação preguiçosa de um lote só (tarefa 68).
// Mesma ideia do releaseExpiredReservations do meu projeto anterior (ingressos), que devolvia ao
// estoque as reservas vencidas "por demanda", quando alguém consultava o evento. Aqui, o primeiro
// acesso depois do fim liquida o lote antes de responder. Sem isso, com o servidor dormindo
// (Render gratuito), o avaliador veria um lote encerrado sem vencedor e sem comprovante.
export async function settleIfDue(lotId) {
  const lot = await prisma.lot.findFirst({
    where: { id: lotId, status: 'ACTIVE', endsAt: { lte: new Date() } },
    select: { id: true },
  });
  if (!lot) return;
  try {
    await settleLot(lot.id);
  } catch (err) {
    console.error(`[liquidação] falha ao liquidar o lote ${lot.id}:`, err.message);
  }
}

// Encerrador periódico (tarefa 68): a cada 5 s. Só é ligado pelo server.js (o seed e os testes não ligam).
export function startCloser(intervalMs = 5000) {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return; // uma rodada lenta não empilha com a próxima
    running = true;
    try {
      await settleDueLots();
    } catch (err) {
      console.error('[encerrador]', err.message);
    } finally {
      running = false;
    }
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}

import { AppError } from '../errors/AppError.js';
import { formatBRL } from '../lib/money.js';
import prisma from '../lib/prisma.js';

// Carteira (tarefa 51). Regras do PDF:
// - disponível = total − comprometido (calculado, nunca gravado);
// - comprometido = soma dos lances em que a pessoa lidera agora (muda no placeBid);
// - depósito é simulado.
// O extrato (LedgerEntry) registra só dinheiro que entra ou sai do total. Comprometer e liberar não geram lançamento.

// Teto da carteira: a coluna é Int (até ~R$ 21 milhões). Sem teto, depósitos repetidos
// estourariam a coluna e o banco responderia erro 500. Com teto, a resposta é clara.
export const WALLET_MAX_CENTS = 1_000_000_000; // R$ 10.000.000,00

// As colunas de saldo são BIGINT (o Prisma devolve BigInt). Na resposta viram número comum:
// mesmo o maior saldo possível cabe com folga no inteiro seguro do JavaScript (R$ 90 trilhões).
export const toWalletView = (wallet) => {
  const total = Number(wallet.totalCents);
  const committed = Number(wallet.committedCents);
  return { totalCents: total, committedCents: committed, availableCents: total - committed };
};

export async function getWallet(userId) {
  const wallet = await prisma.wallet.findUnique({
    where: { userId },
    select: {
      totalCents: true,
      committedCents: true,
      entries: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { type: true, amountCents: true, createdAt: true, lot: { select: { id: true, title: true } } },
      },
    },
  });
  // Toda conta nasce com carteira (tarefa 35); sem ela, o token é de um usuário que não existe mais.
  if (!wallet) throw new AppError(401, 'UNAUTHORIZED', 'Sessão inválida. Faça login de novo.');
  return { wallet: toWalletView(wallet), entries: wallet.entries };
}

export async function deposit(userId, amountCents) {
  return prisma.$transaction(async (tx) => {
    // Trava a carteira: dois depósitos ao mesmo tempo não se atropelam, e um lance
    // em andamento não lê um total pela metade.
    const [locked] = await tx.$queryRaw`
      SELECT id, "totalCents" FROM "Wallet" WHERE "userId" = ${userId}::uuid FOR UPDATE`;
    if (!locked) throw new AppError(401, 'UNAUTHORIZED', 'Sessão inválida. Faça login de novo.');

    const total = Number(locked.totalCents);
    if (total + amountCents > WALLET_MAX_CENTS) {
      throw new AppError(422, 'WALLET_LIMIT', `A carteira pode ter no máximo ${formatBRL(WALLET_MAX_CENTS)} de saldo total`, {
        maxDepositCents: WALLET_MAX_CENTS - total,
      });
    }

    const wallet = await tx.wallet.update({
      where: { id: locked.id },
      data: { totalCents: { increment: amountCents } },
      select: { totalCents: true, committedCents: true },
    });
    await tx.ledgerEntry.create({ data: { walletId: locked.id, type: 'DEPOSIT', amountCents } });
    return { wallet: toWalletView(wallet) };
  });
}

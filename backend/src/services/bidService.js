import { AppError, BidRejectedError, NotFoundError } from '../errors/AppError.js';
import { bidHash, bidSeal, endsAtAfterBid, headSeal, participantSeal } from '../lib/auditChain.js';
import { formatBRL } from '../lib/money.js';
import prisma from '../lib/prisma.js';
import { isUuid } from '../validators/lotSchemas.js';
import { minNextBidCents } from './lotService.js';
import { toWalletView } from './walletService.js';

// placeBid (tarefas 55 a 59): a regra mais importante do desafio.
//
// Três linhas mudam juntas (o lote, a carteira de quem dá o lance e a do líder superado)
// e o relógio importa. Tudo acontece numa transação com trava de linha:
//   1. trava o lote (SELECT ... FOR UPDATE). Quem chega depois ESPERA aqui;
//   2. lê o relógio DO BANCO depois da trava (D13);
//   3. checagens na ordem da tarefa 56;
//   4. trava as carteiras sempre em ordem de userId (evita deadlock);
//   5. confere saldo, compromete/libera, grava o lance encadeado, atualiza o lote e prorroga.

// Espera pela trava e pela conexão: com muitos lances no mesmo lote, a fila pode passar dos 5 s padrão do Prisma.
const TX_OPTIONS = { maxWait: 10_000, timeout: 15_000 };

const SAO_PAULO = { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' };
const formatDateTime = (date) => date.toLocaleString('pt-BR', SAO_PAULO);

const aliasLabel = (alias) => `Licitante #${alias}`;

function bidView(bid) {
  return { seq: bid.seq, alias: aliasLabel(bid.alias), amountCents: bid.amountCents, createdAt: bid.createdAt };
}

// Resposta de sucesso. Mesmo formato para lance novo e para repetição com a mesma Idempotency-Key.
async function successPayload(tx, lotId, bid, userId, serverNow) {
  const lot = await tx.lot.findUnique({
    where: { id: lotId },
    select: { currentPriceCents: true, minIncrementCents: true, startingPriceCents: true, bidCount: true, endsAt: true, leaderId: true },
  });
  const leader = lot.leaderId
    ? await tx.lotParticipant.findUnique({ where: { lotId_userId: { lotId, userId: lot.leaderId } }, select: { alias: true } })
    : null;
  const wallet = await tx.wallet.findUnique({ where: { userId }, select: { totalCents: true, committedCents: true } });
  return {
    bid: bidView(bid),
    lot: {
      id: lotId,
      currentPriceCents: lot.currentPriceCents,
      minNextBidCents: minNextBidCents(lot),
      bidCount: lot.bidCount,
      endsAt: lot.endsAt,
      leaderAlias: leader ? aliasLabel(leader.alias) : null,
      youAreWinning: lot.leaderId === userId,
    },
    wallet: toWalletView(wallet),
    serverNow,
  };
}

// `clock` existe só para o seed criar um lote encerrado com lances no passado (tarefa 78).
// A rota nunca passa esse valor: lá, o horário é sempre o do banco.
export async function placeBid({ lotId: requestedLotId, userId, amountCents, idempotencyKey, clock }) {
  let lotId = requestedLotId;
  if (!isUuid(lotId)) throw new NotFoundError('Lote não encontrado');

  try {
    return await prisma.$transaction(async (tx) => {
      // 1. Trava o lote.
      const [lot] = await tx.$queryRaw`
        SELECT id, "sellerId", status, "startsAt", "endsAt", "startingPriceCents", "minIncrementCents",
               "currentPriceCents", "leaderId", "bidCount", "headHash"
        FROM "Lot" WHERE id = ${lotId}::uuid FOR UPDATE`;

      // A partir daqui, o id é o que veio do banco (minúsculo). O da URL pode vir em maiúsculas,
      // e o Postgres aceita as duas formas, mas o hash e os selos precisam de um texto só.
      if (lot) lotId = lot.id;

      // 2. Relógio do banco, lido DEPOIS de pegar a trava. Se fosse lido antes e o lance esperasse
      //    300 ms na fila, um lance que chegou antes do fim poderia ser gravado depois dele.
      //    Arredondado para milissegundo: é a precisão do banco (timestamp(3)) e do hash.
      const now = clock ?? (await tx.$queryRaw`SELECT date_trunc('milliseconds', clock_timestamp()) AS now`)[0].now;

      // Idempotency-Key (tarefa 61): a mesma chave devolve o mesmo lance, sem criar outro.
      // Conferida depois da trava do lote, então dois envios iguais simultâneos entram em fila.
      if (idempotencyKey) {
        const previous = await tx.bid.findUnique({
          where: { bidderId_idempotencyKey: { bidderId: userId, idempotencyKey } },
        });
        if (previous) {
          if (previous.lotId !== lotId) {
            throw new AppError(422, 'IDEMPOTENCY_KEY_REUSED', 'Esta Idempotency-Key já foi usada em outro lote');
          }
          return { replayed: true, ...(await successPayload(tx, lotId, previous, userId, now)) };
        }
      }

      // 3. Checagens, NA ORDEM da tarefa 56.
      // 3.1 Não existe ou cancelado → 404 (mesma resposta, não revela o cancelado).
      if (!lot || lot.status === 'CANCELLED') throw new NotFoundError('Lote não encontrado');
      // 3.2 Ainda não começou.
      if (now < lot.startsAt) {
        throw new BidRejectedError('LOT_NOT_STARTED', `Este lote ainda não começou. Abre em ${formatDateTime(lot.startsAt)}`, {
          startsAt: lot.startsAt,
        });
      }
      // 3.3 Encerrado: no EXATO fim já está encerrado (>=), igual ao lotPhase.
      if (lot.status === 'SETTLED' || now >= lot.endsAt) {
        throw new BidRejectedError('LOT_ENDED', 'Este lote já foi encerrado');
      }
      // 3.4 O líder não cobre o próprio lance.
      if (lot.leaderId === userId) {
        throw new BidRejectedError('ALREADY_WINNING', 'Você já está ganhando este lote');
      }
      // 3.5 Mínimo: 1º lance >= lance inicial; os seguintes >= lance atual + incremento.
      const minimum = minNextBidCents(lot);
      if (amountCents < minimum) {
        throw new BidRejectedError('BELOW_MINIMUM', `O lance mínimo agora é ${formatBRL(minimum)}`, {
          minNextBidCents: minimum,
        });
      }

      // 4. Trava as carteiras envolvidas, sempre em ordem de userId.
      //    Ex.: A dá lance no lote 1 (líder B) enquanto B dá lance no lote 2 (líder A).
      //    Se cada um travasse "a minha primeiro", um esperaria o outro para sempre.
      const userIds = [userId, lot.leaderId].filter(Boolean).sort();
      const wallets = await tx.$queryRaw`
        SELECT id, "userId", "totalCents", "committedCents" FROM "Wallet"
        WHERE "userId" = ANY(${userIds}::uuid[]) ORDER BY "userId" FOR UPDATE`;
      const myWallet = wallets.find((w) => w.userId === userId);
      if (!myWallet) throw new AppError(401, 'UNAUTHORIZED', 'Sessão inválida. Faça login de novo.');

      // 3.6 Saldo: disponível da carteira TRAVADA. Dinheiro que já lidera outro lote está comprometido,
      //     então R$ 100 não lideram dois lotes de R$ 80.
      const available = myWallet.totalCents - myWallet.committedCents;
      if (amountCents > available) {
        throw new BidRejectedError('INSUFFICIENT_BALANCE', `Saldo disponível insuficiente: ${formatBRL(available)}`, {
          availableCents: available,
        });
      }

      // 5. Aceito.
      // Apelido por lote (tarefa 59): "Licitante #N" na ordem do primeiro lance. O lote está travado: sem corrida.
      let participant = await tx.lotParticipant.findUnique({ where: { lotId_userId: { lotId, userId } } });
      if (!participant) {
        const alias = (await tx.lotParticipant.count({ where: { lotId } })) + 1;
        participant = await tx.lotParticipant.create({
          data: { lotId, userId, alias, seal: participantSeal(lotId, alias, userId) },
        });
      }

      // Anti-sniping (tarefa 58, D9): soma 2 min ao fim lido DEPOIS da trava.
      const endsAtAfter = endsAtAfterBid(lot.endsAt, now);

      // Lance encadeado (tarefa 54). O MESMO Date vai para o hash e para o banco.
      const seq = lot.bidCount + 1;
      const chained = { lotId, seq, alias: participant.alias, amountCents, createdAt: now, endsAtAfter, prevHash: lot.headHash };
      const hash = bidHash(chained);
      const bid = await tx.bid.create({
        data: { ...chained, bidderId: userId, hash, seal: bidSeal(hash), idempotencyKey: idempotencyKey ?? null },
      });

      // Comprometer e liberar (tarefa 57). Os CHECKs do banco (tarefa 24) seguram qualquer erro de conta.
      await tx.wallet.update({ where: { userId }, data: { committedCents: { increment: amountCents } } });
      if (lot.leaderId) {
        // O líder superado recebe de volta, na hora, o valor que estava comprometido neste lote.
        await tx.wallet.update({ where: { userId: lot.leaderId }, data: { committedCents: { decrement: lot.currentPriceCents } } });
      }

      await tx.lot.update({
        where: { id: lotId },
        data: {
          currentPriceCents: amountCents,
          leaderId: userId,
          bidCount: seq,
          endsAt: endsAtAfter,
          headHash: hash,
          headSeal: headSeal(lotId, seq, hash),
        },
      });

      return {
        replayed: false,
        extended: endsAtAfter.getTime() !== lot.endsAt.getTime(),
        ...(await successPayload(tx, lotId, bid, userId, now)),
      };
    }, TX_OPTIONS);
  } catch (err) {
    // Duas requisições com a mesma Idempotency-Key em lotes diferentes, ao mesmo tempo.
    if (err?.code === 'P2002' && String(err?.meta?.target ?? err?.message).includes('idempotencyKey')) {
      throw new AppError(422, 'IDEMPOTENCY_KEY_REUSED', 'Esta Idempotency-Key já foi usada em outro lance');
    }
    // Fila grande demais no mesmo lote: melhor pedir para tentar de novo do que responder 500.
    if (err?.code === 'P2028') {
      throw new AppError(503, 'TRY_AGAIN', 'Muitos lances ao mesmo tempo. Tente de novo.');
    }
    throw err;
  }
}

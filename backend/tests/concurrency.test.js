// Concorrência (itens 7 e 8 da tarefa 100). Os lances saem ao mesmo tempo, sem esperar um pelo outro.
// A trava de linha no lote (e nas carteiras, em ordem) é o que garante um único vencedor.
import { afterAll, beforeEach, expect, it } from 'vitest';
import { bid, makeLot, makeUser, prisma, resetDb, walletOf } from './helpers.js';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

it('20 lances simultâneos de mesmo valor no mesmo lote → só 1 aceito, e o resto recusado por valor', async () => {
  const seller = await makeUser('SELLER');
  const lot = await makeLot(seller, { startingPriceCents: 100_000 });
  const bidders = await Promise.all(Array.from({ length: 20 }, () => makeUser('BIDDER', { balanceCents: 1_000_000 })));

  const results = await Promise.allSettled(bidders.map((b) => bid(lot, b, 100_000)));
  const accepted = results.filter((r) => r.status === 'fulfilled');
  const rejected = results.filter((r) => r.status === 'rejected');

  expect(accepted).toHaveLength(1);
  expect(rejected.map((r) => r.reason.code)).toEqual(Array(19).fill('BELOW_MINIMUM'));

  const saved = await prisma.lot.findUnique({ where: { id: lot.id } });
  expect(saved.bidCount).toBe(1);
  const committed = await Promise.all(bidders.map(walletOf));
  expect(committed.filter((w) => w.committed > 0)).toHaveLength(1);
});

it('saldo para um lance só, em dois lotes ao mesmo tempo → só 1 aceito, sem saldo negativo', async () => {
  const seller = await makeUser('SELLER');
  const lot1 = await makeLot(seller, { startingPriceCents: 100_000 });
  const lot2 = await makeLot(seller, { startingPriceCents: 100_000 });
  const pessoa = await makeUser('BIDDER', { balanceCents: 150_000 });

  const results = await Promise.allSettled([bid(lot1, pessoa, 100_000), bid(lot2, pessoa, 100_000)]);
  expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  expect(results.find((r) => r.status === 'rejected').reason.code).toBe('INSUFFICIENT_BALANCE');
  expect(await walletOf(pessoa)).toEqual({ total: 150_000, committed: 100_000, available: 50_000 });
});

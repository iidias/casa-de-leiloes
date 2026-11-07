// Liquidação (item 10 da tarefa 100). PDF: ao encerrar, debita o vencedor, credita o leiloeiro e
// gera o comprovante; lote sem lances fecha sem vencedor.
import { afterAll, beforeEach, expect, it } from 'vitest';
import { settleLot } from '../src/services/settlementService.js';
import { bid, makeLot, makeUser, minutes, prisma, resetDb, walletOf } from './helpers.js';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

const afterEnd = (lot) => ({ now: new Date(new Date(lot.endsAt).getTime() + 1000) });

it('debita o vencedor, credita o leiloeiro, libera o comprometido e gera o comprovante', async () => {
  const seller = await makeUser('SELLER');
  const ana = await makeUser('BIDDER', { balanceCents: 1_000_000 });
  const bia = await makeUser('BIDDER', { balanceCents: 1_000_000 });
  const lot = await makeLot(seller);
  await bid(lot, ana, 100_000);
  await bid(lot, bia, 110_000);

  const result = await settleLot(lot.id, afterEnd(lot));
  expect(result).toMatchObject({ sold: true, finalPriceCents: 110_000, winnerAlias: 'Licitante #2' });

  expect(await walletOf(bia)).toEqual({ total: 890_000, committed: 0, available: 890_000 });
  expect(await walletOf(ana)).toEqual({ total: 1_000_000, committed: 0, available: 1_000_000 });
  expect(await walletOf(seller)).toEqual({ total: 110_000, committed: 0, available: 110_000 });

  const receipt = await prisma.receipt.findUnique({ where: { lotId: lot.id } });
  expect(receipt).toMatchObject({ winnerId: bia.id, sellerId: seller.id, amountCents: 110_000 });
  const saved = await prisma.lot.findUnique({ where: { id: lot.id } });
  expect(receipt.finalChainHash).toBe(saved.headHash);
});

it('rodar a liquidação duas vezes (ou ao mesmo tempo) não debita duas vezes', async () => {
  const seller = await makeUser('SELLER');
  const ana = await makeUser('BIDDER', { balanceCents: 1_000_000 });
  const lot = await makeLot(seller);
  await bid(lot, ana, 100_000);

  await Promise.all([settleLot(lot.id, afterEnd(lot)), settleLot(lot.id, afterEnd(lot))]);
  await settleLot(lot.id, afterEnd(lot));

  expect(await walletOf(ana)).toEqual({ total: 900_000, committed: 0, available: 900_000 });
  expect(await walletOf(seller)).toEqual({ total: 100_000, committed: 0, available: 100_000 });
  expect(await prisma.receipt.count({ where: { lotId: lot.id } })).toBe(1);
  expect(await prisma.ledgerEntry.count({ where: { lotId: lot.id } })).toBe(2); // 1 débito + 1 crédito
});

it('lote sem lances fecha sem vencedor e sem comprovante', async () => {
  const seller = await makeUser('SELLER');
  const lot = await makeLot(seller);
  const result = await settleLot(lot.id, afterEnd(lot));
  expect(result).toMatchObject({ sold: false });
  const saved = await prisma.lot.findUnique({ where: { id: lot.id } });
  expect(saved).toMatchObject({ status: 'SETTLED', winnerId: null, finalPriceCents: null });
  expect(await prisma.receipt.count()).toBe(0);
  expect(await walletOf(seller)).toEqual({ total: 0, committed: 0, available: 0 });
});

it('não liquida antes do fim', async () => {
  const seller = await makeUser('SELLER');
  const lot = await makeLot(seller);
  expect(await settleLot(lot.id, { now: new Date(new Date(lot.endsAt).getTime() - minutes(1)) })).toBeNull();
  expect((await prisma.lot.findUnique({ where: { id: lot.id } })).status).toBe('ACTIVE');
});

it('leiloeiro com mais de R$ 21,47 mi recebidos (limite do INTEGER) continua recebendo e o lote liquida', async () => {
  const seller = await makeUser('SELLER');
  const ana = await makeUser('BIDDER', { balanceCents: 10_000_000 });
  await prisma.wallet.update({ where: { userId: seller.id }, data: { totalCents: 2_145_000_000 } });
  const lot = await makeLot(seller, { startingPriceCents: 5_000_000 });
  await bid(lot, ana, 5_000_000);

  const result = await settleLot(lot.id, afterEnd(lot));
  expect(result).toMatchObject({ sold: true, finalPriceCents: 5_000_000 });
  expect(await walletOf(seller)).toEqual({ total: 2_150_000_000, committed: 0, available: 2_150_000_000 });
});

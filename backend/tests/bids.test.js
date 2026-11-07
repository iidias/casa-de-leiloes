// Regras de lance do PDF (pág. 4) e as mensagens de recusa (pág. 3). Itens 1 a 6 e 9 da tarefa 100.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { bid, makeLot, makeUser, minutes, prisma, rejectionOf, resetDb, walletOf } from './helpers.js';

let seller;
let ana;
let bia;

beforeEach(async () => {
  await resetDb();
  seller = await makeUser('SELLER');
  ana = await makeUser('BIDDER', { balanceCents: 5_000_000 });
  bia = await makeUser('BIDDER', { balanceCents: 5_000_000 });
});
afterAll(() => prisma.$disconnect());

describe('valor mínimo', () => {
  it('primeiro lance: abaixo do lance inicial é recusado; igual ao inicial é aceito (sem somar o incremento)', async () => {
    const lot = await makeLot(seller, { startingPriceCents: 100_000, minIncrementCents: 10_000 });
    expect(await rejectionOf(bid(lot, ana, 99_999))).toBe('BELOW_MINIMUM');
    const ok = await bid(lot, ana, 100_000);
    expect(ok.lot.currentPriceCents).toBe(100_000);
    expect(ok.lot.minNextBidCents).toBe(110_000);
  });

  it('lances seguintes: abaixo de atual + incremento é recusado; igual é aceito', async () => {
    const lot = await makeLot(seller, { startingPriceCents: 100_000, minIncrementCents: 10_000 });
    await bid(lot, ana, 100_000);
    expect(await rejectionOf(bid(lot, bia, 109_999))).toBe('BELOW_MINIMUM');
    const ok = await bid(lot, bia, 110_000);
    expect(ok.lot.currentPriceCents).toBe(110_000);
  });

  it('a recusa por valor informa o próximo lance mínimo', async () => {
    const lot = await makeLot(seller);
    await bid(lot, ana, 100_000);
    const err = await bid(lot, bia, 100_000).catch((e) => e);
    expect(err.code).toBe('BELOW_MINIMUM');
    expect(err.details.minNextBidCents).toBe(110_000);
  });
});

describe('quem pode dar lance e quando', () => {
  it('o líder não pode cobrir o próprio lance', async () => {
    const lot = await makeLot(seller);
    await bid(lot, ana, 100_000);
    expect(await rejectionOf(bid(lot, ana, 200_000))).toBe('ALREADY_WINNING');
  });

  it('lance antes do início → LOT_NOT_STARTED', async () => {
    const lot = await makeLot(seller, { startsIn: 10, endsIn: 70 });
    expect(await rejectionOf(bid(lot, ana, 100_000))).toBe('LOT_NOT_STARTED');
  });

  it('lance no exato horário de fim → LOT_ENDED', async () => {
    const lot = await makeLot(seller);
    expect(await rejectionOf(bid(lot, ana, 100_000, { clock: new Date(lot.endsAt) }))).toBe('LOT_ENDED');
  });
});

describe('saldo comprometido', () => {
  it('compromete ao liderar e volta ao disponível na hora em que é superado', async () => {
    const lot = await makeLot(seller);
    await bid(lot, ana, 100_000);
    expect(await walletOf(ana)).toEqual({ total: 5_000_000, committed: 100_000, available: 4_900_000 });

    await bid(lot, bia, 110_000);
    expect(await walletOf(ana)).toEqual({ total: 5_000_000, committed: 0, available: 5_000_000 });
    expect(await walletOf(bia)).toEqual({ total: 5_000_000, committed: 110_000, available: 4_890_000 });
  });

  it('lance acima do disponível → INSUFFICIENT_BALANCE, e nada muda', async () => {
    const pobre = await makeUser('BIDDER', { balanceCents: 50_000 });
    const lot = await makeLot(seller);
    expect(await rejectionOf(bid(lot, pobre, 100_000))).toBe('INSUFFICIENT_BALANCE');
    expect(await walletOf(pobre)).toEqual({ total: 50_000, committed: 0, available: 50_000 });
    expect((await prisma.lot.findUnique({ where: { id: lot.id } })).bidCount).toBe(0);
  });

  it('o disponível considera o que já está comprometido em outro lote', async () => {
    const lot1 = await makeLot(seller);
    const lot2 = await makeLot(seller);
    const justo = await makeUser('BIDDER', { balanceCents: 150_000 });
    await bid(lot1, justo, 100_000);
    expect(await rejectionOf(bid(lot2, justo, 100_000))).toBe('INSUFFICIENT_BALANCE');
  });
});

describe('prorrogação (anti-sniping)', () => {
  it('lance com 1 min restante → fim anterior + 2 min (sobram 3 min)', async () => {
    const lot = await makeLot(seller);
    const end = new Date(lot.endsAt);
    const res = await bid(lot, ana, 100_000, { clock: new Date(end.getTime() - minutes(1)) });
    expect(new Date(res.lot.endsAt).getTime()).toBe(end.getTime() + minutes(2));
  });

  it('dois lances seguidos, cada um nos últimos 2 min do fim da vez → +4 min no total', async () => {
    const lot = await makeLot(seller);
    const end = new Date(lot.endsAt).getTime();
    await bid(lot, ana, 100_000, { clock: new Date(end - minutes(1)) }); // fim vira end + 2 min
    // 1 min antes do NOVO fim: prorroga de novo, somando ao fim atual.
    const res = await bid(lot, bia, 110_000, { clock: new Date(end + minutes(1)) });
    expect(new Date(res.lot.endsAt).getTime()).toBe(end + minutes(4));
  });

  it('lance com 2:30 restantes depois de uma prorrogação → não prorroga de novo', async () => {
    const lot = await makeLot(seller);
    const end = new Date(lot.endsAt).getTime();
    await bid(lot, ana, 100_000, { clock: new Date(end - minutes(1)) }); // fim vira end + 2 min
    const res = await bid(lot, bia, 110_000, { clock: new Date(end - minutes(0.5)) });
    expect(new Date(res.lot.endsAt).getTime()).toBe(end + minutes(2));
  });

  it('exatamente 2:00 restantes também prorroga', async () => {
    const lot = await makeLot(seller);
    const end = new Date(lot.endsAt).getTime();
    const res = await bid(lot, ana, 100_000, { clock: new Date(end - minutes(2)) });
    expect(new Date(res.lot.endsAt).getTime()).toBe(end + minutes(2));
  });

  it('lance com 10 min restantes → fim inalterado', async () => {
    const lot = await makeLot(seller);
    const end = new Date(lot.endsAt).getTime();
    const res = await bid(lot, ana, 100_000, { clock: new Date(end - minutes(10)) });
    expect(new Date(res.lot.endsAt).getTime()).toBe(end);
  });
});

// Rotas HTTP de verdade (itens 12 a 14 da tarefa 100): link do comprovante, "não é seu" = 404
// e as recusas de papel. Lições da devolutiva do projeto anterior: link assinado, nada de dado
// pessoal na rota pública e nunca confirmar que um recurso alheio existe.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { settleLot } from '../src/services/settlementService.js';
import { bid, makeLot, makeUser, prisma, resetDb, startServer } from './helpers.js';

let api;
let seller;
let ana;
let bia;
let lot;
let receipt;

beforeAll(async () => {
  api = await startServer();
});
afterAll(async () => {
  await api.close();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await resetDb();
  seller = await makeUser('SELLER');
  ana = await makeUser('BIDDER', { balanceCents: 1_000_000 });
  bia = await makeUser('BIDDER', { balanceCents: 1_000_000 });
  lot = await makeLot(seller);
  await bid(lot, ana, 100_000);
  await settleLot(lot.id, { now: new Date(new Date(lot.endsAt).getTime() + 1000) });
  receipt = await prisma.receipt.findUnique({ where: { lotId: lot.id } });
});

const tokenOf = (shareUrl) => new URL(shareUrl).pathname.split('/c/')[1];

async function shareToken() {
  const wins = await api.request('GET', '/me/wins', { token: ana.token });
  return tokenOf(wins.body.wins[0].shareUrl);
}

describe('link público do comprovante', () => {
  it('link válido → 200, sem dado pessoal, sem o próprio link e sem ids internos', async () => {
    const token = await shareToken();
    const res = await api.request('GET', `/public/receipts/${token}`);
    expect(res.status).toBe(200);
    expect(res.body.receipt).toMatchObject({ winnerAlias: 'Licitante #1', amountCents: 100_000, signatureValid: true, chainMatches: true });
    const json = JSON.stringify(res.body);
    for (const secret of [ana.id, ana.email, ana.name, seller.id, seller.email, receipt.id, receipt.linkId, token]) {
      expect(json).not.toContain(secret);
    }
  });

  it('um caractere trocado → 404', async () => {
    const token = await shareToken();
    const last = token.at(-1) === 'A' ? 'B' : 'A';
    const res = await api.request('GET', `/public/receipts/${token.slice(0, -1)}${last}`);
    expect(res.status).toBe(404);
  });

  it('link revogado (gerou um novo) → 404; o novo funciona', async () => {
    const old = await shareToken();
    const rotated = await api.request('POST', `/me/receipts/${receipt.id}/share-link`, { token: ana.token });
    expect(rotated.status).toBe(200);
    expect((await api.request('GET', `/public/receipts/${old}`)).status).toBe(404);
    expect((await api.request('GET', `/public/receipts/${tokenOf(rotated.body.shareUrl)}`)).status).toBe(200);
  });

  it('forjado, revogado ou inexistente respondem igual', async () => {
    const a = await api.request('GET', '/public/receipts/qualquer-coisa');
    const b = await api.request('GET', `/public/receipts/r1.${'A'.repeat(22)}.${'B'.repeat(22)}`);
    expect(a).toEqual(b);
    expect(a.status).toBe(404);
  });
});

describe('recurso de outra pessoa → 404, nunca 403', () => {
  it('comprovante de outro licitante', async () => {
    expect((await api.request('GET', `/me/receipts/${receipt.id}`, { token: bia.token })).status).toBe(404);
    expect((await api.request('POST', `/me/receipts/${receipt.id}/share-link`, { token: bia.token })).status).toBe(404);
    expect((await api.request('GET', `/me/receipts/${receipt.id}`, { token: ana.token })).status).toBe(200);
  });

  it('lote de outro leiloeiro (ver e cancelar)', async () => {
    const outro = await makeUser('SELLER');
    const aberto = await makeLot(seller);
    expect((await api.request('GET', `/seller/lots/${aberto.id}`, { token: outro.token })).status).toBe(404);
    expect((await api.request('POST', `/seller/lots/${aberto.id}/cancel`, { token: outro.token })).status).toBe(404);
    expect((await prisma.lot.findUnique({ where: { id: aberto.id } })).status).toBe('ACTIVE');
  });
});

describe('papéis e cancelamento', () => {
  it('leiloeiro dando lance → 403, com a mensagem do PDF', async () => {
    const aberto = await makeLot(seller);
    const res = await api.request('POST', `/lots/${aberto.id}/bids`, { token: seller.token, body: { amountCents: 100_000 } });
    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe('Leiloeiros não podem dar lances');
  });

  it('cancelar lote com lance → 409; sem lance → cancela e some da vitrine', async () => {
    const comLance = await makeLot(seller);
    await bid(comLance, bia, 100_000);
    const recusa = await api.request('POST', `/seller/lots/${comLance.id}/cancel`, { token: seller.token });
    expect(recusa.status).toBe(409);
    expect(recusa.body.error.code).toBe('LOT_HAS_BIDS');

    const semLance = await makeLot(seller);
    expect((await api.request('POST', `/seller/lots/${semLance.id}/cancel`, { token: seller.token })).status).toBe(200);
    const vitrine = await api.request('GET', '/lots');
    expect(vitrine.body.lots.map((l) => l.id)).not.toContain(semLance.id);
    expect((await api.request('GET', `/lots/${semLance.id}`)).status).toBe(404);
  });

  it('lance pela rota HTTP devolve as 5 recusas com o código certo', async () => {
    const aberto = await makeLot(seller);
    const agendado = await makeLot(seller, { startsIn: 10, endsIn: 70 });
    const post = (l, user, amountCents) => api.request('POST', `/lots/${l.id}/bids`, { token: user.token, body: { amountCents } });
    const pobre = await makeUser('BIDDER', { balanceCents: 10_000 });

    expect((await post(aberto, bia, 50_000)).body.error.code).toBe('BELOW_MINIMUM');
    expect((await post(aberto, pobre, 100_000)).body.error.code).toBe('INSUFFICIENT_BALANCE');
    expect((await post(aberto, bia, 100_000)).status).toBe(201);
    expect((await post(aberto, bia, 200_000)).body.error.code).toBe('ALREADY_WINNING');
    expect((await post(agendado, bia, 100_000)).body.error.code).toBe('LOT_NOT_STARTED');
    expect((await post(lot, bia, 500_000)).body.error.code).toBe('LOT_ENDED');
  });
});

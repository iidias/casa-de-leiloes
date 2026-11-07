// Auditoria (item 11 da tarefa 100). PDF: "qualquer alteração, remoção ou inserção posterior no
// histórico (mesmo direto no banco de dados) deve ser detectada". Cada teste mexe no banco com SQL,
// como faria alguém com acesso direto, e confere que a auditoria pública acusa.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { bidCanonical } from '../src/lib/auditChain.js';
import { sha256Hex } from '../src/lib/crypto.js';
import { getLotAudit } from '../src/services/auditService.js';
import { bid, makeLot, makeUser, prisma, resetDb } from './helpers.js';

let lot;
let ana;

beforeEach(async () => {
  await resetDb();
  const seller = await makeUser('SELLER');
  ana = await makeUser('BIDDER', { balanceCents: 1_000_000 });
  const bia = await makeUser('BIDDER', { balanceCents: 1_000_000 });
  lot = await makeLot(seller);
  await bid(lot, ana, 100_000);
  await bid(lot, bia, 110_000);
  await bid(lot, ana, 120_000);
});
afterAll(() => prisma.$disconnect());

const audit = () => getLotAudit(lot.id);

it('histórico sem mexer → íntegro, sem dado pessoal na resposta', async () => {
  const result = await audit();
  expect(result.integrity).toMatchObject({ ok: true, problems: [] });
  expect(result.bids).toHaveLength(3);
  const json = JSON.stringify(result);
  expect(json).not.toContain(ana.id);
  expect(json).not.toContain(ana.email);
  expect(json).not.toMatch(/bidderId|userId|sellerId|winnerId|leaderId|seal/);
});

describe('adulterações direto no banco', () => {
  it('UPDATE no valor de um lance do meio', async () => {
    await prisma.$executeRaw`UPDATE "Bid" SET "amountCents" = 105000 WHERE "lotId" = ${lot.id}::uuid AND seq = 2`;
    const { integrity } = await audit();
    expect(integrity.ok).toBe(false);
    expect(integrity.problems.join(' ')).toContain('Lance #2');
  });

  it('UPDATE no valor e recálculo do hash (sem a chave, o selo não bate)', async () => {
    const [b] = await prisma.$queryRaw`SELECT * FROM "Bid" WHERE "lotId" = ${lot.id}::uuid AND seq = 3`;
    const changed = { ...b, amountCents: 500_000 };
    await prisma.$executeRaw`UPDATE "Bid" SET "amountCents" = 500000, hash = ${sha256Hex(bidCanonical(changed))} WHERE id = ${b.id}::uuid`;
    const { integrity } = await audit();
    expect(integrity.ok).toBe(false);
    expect(integrity.problems.join(' ')).toMatch(/Lance #3: selo inválido/);
  });

  it('DELETE de um lance do meio', async () => {
    await prisma.$executeRaw`DELETE FROM "Bid" WHERE "lotId" = ${lot.id}::uuid AND seq = 2`;
    const { integrity } = await audit();
    expect(integrity.ok).toBe(false);
    expect(integrity.problems.join(' ')).toMatch(/Faltam lances entre o #1 e o #3/);
  });

  it('DELETE do último lance, acertando o lote junto (preço, líder, contagem e topo)', async () => {
    const [second] = await prisma.$queryRaw`SELECT * FROM "Bid" WHERE "lotId" = ${lot.id}::uuid AND seq = 2`;
    await prisma.$executeRaw`DELETE FROM "Bid" WHERE "lotId" = ${lot.id}::uuid AND seq = 3`;
    await prisma.$executeRaw`UPDATE "Lot" SET "bidCount" = 2, "currentPriceCents" = ${second.amountCents},
      "leaderId" = ${second.bidderId}::uuid, "headHash" = ${second.hash}, "endsAt" = ${second.endsAtAfter} WHERE id = ${lot.id}::uuid`;
    const { integrity } = await audit();
    expect(integrity.ok).toBe(false);
    expect(integrity.problems).toContain('Selo do topo do lote inválido');
  });

  it('INSERT de um lance forjado', async () => {
    const [last] = await prisma.$queryRaw`SELECT * FROM "Bid" WHERE "lotId" = ${lot.id}::uuid AND seq = 3`;
    const forged = { ...last, seq: 4, amountCents: 130_000, prevHash: last.hash };
    await prisma.$executeRaw`INSERT INTO "Bid" (id, "lotId", seq, "bidderId", alias, "amountCents", "createdAt", "endsAtAfter", "prevHash", hash, seal)
      VALUES (${randomUUID()}::uuid, ${lot.id}::uuid, 4, ${last.bidderId}::uuid, ${last.alias}, 130000, ${last.createdAt}, ${last.endsAtAfter},
              ${last.hash}, ${sha256Hex(bidCanonical(forged))}, ${'0'.repeat(64)})`;
    const { integrity } = await audit();
    expect(integrity.ok).toBe(false);
    expect(integrity.problems.join(' ')).toMatch(/Lance #4: selo inválido/);
  });

  it('trocar a pessoa por trás de um apelido', async () => {
    const outra = await makeUser('BIDDER');
    await prisma.$executeRaw`UPDATE "LotParticipant" SET "userId" = ${outra.id}::uuid WHERE "lotId" = ${lot.id}::uuid AND alias = 1`;
    const { integrity } = await audit();
    expect(integrity.ok).toBe(false);
    expect(integrity.problems.join(' ')).toMatch(/Licitante #1: o vínculo do apelido com a pessoa foi alterado/);
  });
});

// Apoio dos testes: banco limpo, usuários, lotes e um servidor HTTP de verdade.
// Tudo passa pelos services, como no seed: lance criado direto no banco não teria hash nem selo.
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import { env } from '../src/config/env.js';
import prisma from '../src/lib/prisma.js';
import { placeBid } from '../src/services/bidService.js';
import { createLotFromArtwork } from '../src/services/lotService.js';
import { deposit } from '../src/services/walletService.js';

export { prisma };

const MINUTE = 60 * 1000;
export const minutes = (n) => n * MINUTE;

// Apaga tudo, menos o histórico de migrations. Ordem não importa com CASCADE.
export async function resetDb() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "Bid", "LotParticipant", "Receipt", "LedgerEntry", "LotImage", "Lot", "Wallet", "User" CASCADE',
  );
}

// Usuário + carteira, como no cadastro. A senha não importa aqui (o token é emitido direto).
export async function makeUser(role = 'BIDDER', { balanceCents = 0 } = {}) {
  const id = randomUUID();
  const user = await prisma.user.create({
    data: { id, name: `Pessoa ${id.slice(0, 6)}`, email: `${id}@teste.local`, passwordHash: 'x', role, wallet: { create: {} } },
  });
  if (balanceCents > 0) await deposit(user.id, balanceCents);
  // Mesmo formato do token do authService: só o papel no corpo e o id no "sub".
  const token = jwt.sign({ role }, env.jwtSecret, { subject: user.id, expiresIn: '1h', algorithm: 'HS256' });
  return { ...user, token };
}

const ARTWORK = {
  externalId: '27992',
  title: 'Obra de teste',
  artist: 'Artista de teste',
  dateDisplay: '1884',
  medium: 'Óleo sobre tela',
  dimensions: '10 × 10 cm',
};
const IMAGE = { mimeType: 'image/jpeg', bytes: Buffer.from([0xff, 0xd8, 0xff, 0xd9]) };

// Lote ao vivo por padrão: começou há 1 min e termina em 1 h. Horários relativos ao relógio do banco.
export async function makeLot(seller, { startsIn = -1, endsIn = 60, startingPriceCents = 100_000, minIncrementCents = 10_000 } = {}) {
  const now = await dbNow();
  return createLotFromArtwork(
    seller.id,
    {
      startingPriceCents,
      minIncrementCents,
      startsAt: new Date(now.getTime() + minutes(startsIn)),
      endsAt: new Date(now.getTime() + minutes(endsIn)),
    },
    ARTWORK,
    IMAGE,
  );
}

export async function dbNow() {
  const [{ now }] = await prisma.$queryRaw`SELECT date_trunc('milliseconds', clock_timestamp()) AS now`;
  return now;
}

export const bid = (lot, user, amountCents, extra = {}) => placeBid({ lotId: lot.id, userId: user.id, amountCents, ...extra });

// Captura a recusa de um lance e devolve o código (BELOW_MINIMUM...). Lance aceito vira erro do teste.
export async function rejectionOf(promise) {
  try {
    await promise;
  } catch (err) {
    return err.code;
  }
  throw new Error('O lance deveria ter sido recusado');
}

export async function walletOf(user) {
  const w = await prisma.wallet.findUnique({ where: { userId: user.id } });
  const total = Number(w.totalCents);
  const committed = Number(w.committedCents);
  return { total, committed, available: total - committed };
}

// Servidor HTTP de verdade numa porta livre, para testar status e corpo das rotas.
export async function startServer() {
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (method, path, { token, body } = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  return { request, close: () => new Promise((resolve) => server.close(resolve)) };
}

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env.js';
import { ConflictError, UnauthorizedError } from '../errors/AppError.js';
import prisma from '../lib/prisma.js';

const BCRYPT_COST = 12;
const TOKEN_TTL = '8h';
const ROLES = ['BIDDER', 'SELLER'];
const isUuid = (value) => z.uuid().safeParse(value).success;

// Hash de uma senha que ninguém tem. Quando o e-mail não existe, o login compara com ele,
// para levar o mesmo tempo de quando o e-mail existe (tarefa 32). Sem isso, medir o tempo
// de resposta revelaria quais e-mails estão cadastrados.
const DUMMY_HASH = bcrypt.hashSync('senha-que-nao-pertence-a-ninguem', BCRYPT_COST);

const INVALID_LOGIN = 'E-mail ou senha inválidos';

// Só o que o próprio usuário pode ver de si mesmo. Nunca o passwordHash.
export function toPublicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

// No token vão só o id (sub) e o papel. O conteúdo de um JWT é legível por qualquer um;
// o que ninguém consegue é forjar, porque a assinatura usa o JWT_SECRET.
function signToken(user) {
  return jwt.sign({ role: user.role }, env.jwtSecret, {
    subject: user.id,
    expiresIn: TOKEN_TTL,
    algorithm: 'HS256',
  });
}

export async function register({ name, email, password, isSeller }) {
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  const role = isSeller ? 'SELLER' : 'BIDDER';

  let user;
  try {
    // Usuário e carteira nascem juntos (tarefa 35): ou os dois existem, ou nenhum.
    user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({ data: { name, email, passwordHash, role } });
      await tx.wallet.create({ data: { userId: created.id } });
      return created;
    });
  } catch (err) {
    if (err?.code === 'P2002') {
      throw new ConflictError('Este e-mail já está cadastrado', 'EMAIL_TAKEN');
    }
    throw err;
  }

  return { token: signToken(user), user: toPublicUser(user) };
}

export async function login({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });

  // Compara SEMPRE, mesmo sem usuário, e só depois decide. Mesma mensagem nos dois casos.
  const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !passwordOk) {
    throw new UnauthorizedError(INVALID_LOGIN);
  }

  return { token: signToken(user), user: toPublicUser(user) };
}

export function verifyToken(token) {
  try {
    const payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
    // Defesa extra: mesmo com assinatura válida, só aceita o formato que o próprio servidor emite.
    if (!isUuid(payload.sub) || !ROLES.includes(payload.role)) throw new Error('payload inesperado');
    return { sub: payload.sub, role: payload.role };
  } catch {
    // Expirado, assinatura errada ou malformado: para o cliente, tudo é "não autenticado".
    throw new UnauthorizedError('Sessão inválida ou expirada. Entre de novo.');
  }
}

export async function getMe(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  // Token válido de um usuário que não existe mais: trata como sessão inválida.
  if (!user) throw new UnauthorizedError('Sessão inválida ou expirada. Entre de novo.');
  return toPublicUser(user);
}

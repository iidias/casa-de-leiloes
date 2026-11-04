import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';

// Uma única instância do Prisma Client para todo o backend.
// Se cada arquivo criar a sua, o app abre conexões demais com o banco.
const adapter = new PrismaPg({ connectionString: env.databaseUrl });

const prisma = new PrismaClient({ adapter });

export default prisma;

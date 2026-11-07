import { readFileSync } from 'node:fs';
import { parse } from 'dotenv';
import { defineConfig } from 'vitest/config';

// Testes automatizados (tarefas 99 e 100). Rodam contra um banco SÓ DE TESTE: cada teste apaga
// todas as tabelas antes de começar. O endereço vem de TEST_DATABASE_URL (no .env ou no ambiente),
// nunca de DATABASE_URL. Se os dois forem iguais, os testes nem começam.

function readDotEnv() {
  try {
    return parse(readFileSync(new URL('./.env', import.meta.url)));
  } catch {
    return {};
  }
}

const fileEnv = readDotEnv();
const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? fileEnv.TEST_DATABASE_URL;
const mainDatabaseUrl = process.env.DATABASE_URL ?? fileEnv.DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error('Defina TEST_DATABASE_URL no .env com um banco só para os testes (ex.: um branch "test" no Neon).');
}
if (testDatabaseUrl === mainDatabaseUrl) {
  throw new Error('TEST_DATABASE_URL é igual a DATABASE_URL. Os testes apagam o banco: use um banco separado.');
}

// O globalSetup roda neste mesmo processo e aplica as migrations neste banco.
process.env.VITEST_MIGRATE_URL = testDatabaseUrl;

// Chaves fixas e públicas, só para teste. Diferentes das de desenvolvimento e produção,
// para um teste nunca assinar nada com uma chave de verdade.
const testKey = (label) => Buffer.from(`chave-de-teste-${label}-`.padEnd(48, label[0])).toString('base64');

export default defineConfig({
  test: {
    globalSetup: './tests/globalSetup.js',
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: testDatabaseUrl,
      JWT_SECRET: testKey('jwt'),
      AUDIT_HMAC_KEY: testKey('audit'),
      RECEIPT_SIGNING_KEY: testKey('receipt'),
      RECEIPT_LINK_KEY: testKey('link'),
      CORS_ORIGIN: 'http://localhost:5173',
      APP_PUBLIC_URL: 'http://localhost:5173',
      // Os testes nunca chamam a API externa: os lotes são criados com uma obra fixa.
      AIC_BASE_URL: 'http://127.0.0.1:9/api-externa-desligada-nos-testes',
      AIC_CONTACT: 'testes-automatizados',
    },
  },
});

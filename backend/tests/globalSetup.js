import { execSync } from 'node:child_process';

// Antes de tudo: aplica as migrations no banco de teste (cria as tabelas e os CHECKs de saldo).
// `migrate deploy` só aplica o que falta; nunca apaga dados.
export default function setup() {
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: process.env.VITEST_MIGRATE_URL },
  });
}

import 'dotenv/config';
import { z } from 'zod';

// Lê e valida as variáveis de ambiente uma única vez, na subida.
// Se faltar algo ou um segredo for fraco, o servidor NÃO sobe: melhor parar aqui
// do que assinar credenciais com uma chave vazia (o Node aceita createHmac('sha256', '')).

const MIN_SECRET_BYTES = 32;

const secret = (name) =>
  z
    .string({ error: `${name} não definido` })
    .min(1, `${name} está vazio. Gere com: openssl rand -base64 48`)
    .refine((value) => Buffer.from(value, 'base64').length >= MIN_SECRET_BYTES, {
      message: `${name} precisa ter pelo menos ${MIN_SECRET_BYTES} bytes. Gere com: openssl rand -base64 48`,
    });

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z
      .string({ error: 'DATABASE_URL não definido' })
      .startsWith('postgres', 'DATABASE_URL precisa ser uma connection string do PostgreSQL'),

    JWT_SECRET: secret('JWT_SECRET'),
    AUDIT_HMAC_KEY: secret('AUDIT_HMAC_KEY'),
    RECEIPT_SIGNING_KEY: secret('RECEIPT_SIGNING_KEY'),
    RECEIPT_LINK_KEY: secret('RECEIPT_LINK_KEY'),

    CORS_ORIGIN: z.string({ error: 'CORS_ORIGIN não definido' }).min(1, 'CORS_ORIGIN está vazio'),
    APP_PUBLIC_URL: z.string({ error: 'APP_PUBLIC_URL não definido' }).min(1, 'APP_PUBLIC_URL está vazio'),

    AIC_BASE_URL: z.string().min(1).default('https://api.artic.edu/api/v1'),
    AIC_CONTACT: z.string({ error: 'AIC_CONTACT não definido' }).min(1, 'AIC_CONTACT está vazio (contato enviado no header AIC-User-Agent)'),
  })
  .superRefine((env, ctx) => {
    // Uma chave por finalidade: se duas forem iguais, o vazamento de uma derruba as duas.
    const keys = ['JWT_SECRET', 'AUDIT_HMAC_KEY', 'RECEIPT_SIGNING_KEY', 'RECEIPT_LINK_KEY'];
    const seen = new Map();
    for (const key of keys) {
      const other = seen.get(env[key]);
      if (other) {
        ctx.addIssue({ code: 'custom', path: [key], message: `${key} é igual a ${other}; cada segredo precisa ser diferente` });
      }
      seen.set(env[key], key);
    }
  });

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('Variáveis de ambiente inválidas. O servidor não vai subir:');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.') || '(geral)'}: ${issue.message}`);
  }
  process.exit(1);
}

const raw = parsed.data;

export const env = Object.freeze({
  nodeEnv: raw.NODE_ENV,
  port: raw.PORT,
  databaseUrl: raw.DATABASE_URL,
  corsOrigin: raw.CORS_ORIGIN,
  appPublicUrl: raw.APP_PUBLIC_URL,
  aicBaseUrl: raw.AIC_BASE_URL,
  aicContact: raw.AIC_CONTACT,
  jwtSecret: raw.JWT_SECRET,
  // As chaves de HMAC já saem como bytes, prontas para createHmac.
  keys: Object.freeze({
    audit: Buffer.from(raw.AUDIT_HMAC_KEY, 'base64'),
    receiptSigning: Buffer.from(raw.RECEIPT_SIGNING_KEY, 'base64'),
    receiptLink: Buffer.from(raw.RECEIPT_LINK_KEY, 'base64'),
  }),
});


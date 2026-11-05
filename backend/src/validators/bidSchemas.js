import { z } from 'zod';
import { centsSchema } from '../lib/money.js';

// Corpo do lance: só o valor. Lote vem da URL, licitante vem do token.
// Mínimo 1 centavo de propósito: valor positivo abaixo do mínimo do lote cai na regra de negócio
// e recebe a mensagem "O lance mínimo agora é R$ X" (BELOW_MINIMUM), em vez de um erro genérico.
// Teto de R$ 1 milhão por lance: um "0" a mais digitado não vira problema (tarefa 56).
export const bidSchema = z
  .object({ amountCents: centsSchema(1, 100_000_000, 'Lance') })
  .strict();

// Idempotency-Key: o front gera um UUID por envio (tarefa 61).
export const idempotencyKeySchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{8,100}$/, 'Idempotency-Key inválida: use de 8 a 100 letras, números, - ou _')
  .optional();

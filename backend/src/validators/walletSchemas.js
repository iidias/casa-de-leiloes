import { z } from 'zod';
import { centsSchema } from '../lib/money.js';

// Depósito simulado: de R$ 1 a R$ 100.000 por operação (tarefa 51).
export const depositSchema = z
  .object({ amountCents: centsSchema(100, 10_000_000, 'Depósito') })
  .strict();

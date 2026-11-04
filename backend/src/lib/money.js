import { z } from 'zod';

// Dinheiro sempre em centavos inteiros (D3).

// Formata centavos como "R$ 1.234,56", para as mensagens de erro.
export const formatBRL = (cents) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Aceita SOMENTE inteiro seguro em centavos.
// z.number() já recusa a string "100"; .int() recusa 1.5; isSafeInteger recusa 1e20.
// Não usar z.coerce: ele transforma "1e3" em 1000 sem avisar.
export const centsSchema = (min, max, label = 'Valor') =>
  z
    .number({ error: `${label} precisa ser um número inteiro em centavos` })
    .int(`${label} precisa ser um número inteiro em centavos`)
    .min(min, `${label} mínimo é ${formatBRL(min)}`)
    .max(max, `${label} máximo é ${formatBRL(max)}`)
    .refine(Number.isSafeInteger, `${label} inválido`);

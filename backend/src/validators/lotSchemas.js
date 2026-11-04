import { z } from 'zod';
import { centsSchema } from '../lib/money.js';
import { PHASES } from '../lib/lotPhase.js';
import { externalIdSchema } from './catalogSchemas.js';

// Tarefa 42. .strict(): sellerId, status, currentPrice etc. são RECUSADOS.
// O leiloeiro vem do token; título, imagem e atributos vêm da API, buscados no servidor.

const MAX_CENTS = 100_000_000; // R$ 1 milhão
const START_TOLERANCE_MS = 60 * 1000; // "agora" com 1 min de folga para trás
const MIN_DURATION_MS = 2 * 60 * 1000; // baixo de propósito: dá para ver anti-sniping e liquidação sem esperar
const MAX_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

// Horário obrigatoriamente com fuso (Z ou -03:00). Sem fuso, "18:00" seria ambíguo
// e o lote poderia encerrar uma hora antes ou depois (D10).
const isoWithOffset = (label) =>
  z
    .iso.datetime({ offset: true, error: `${label} precisa estar no formato ISO 8601 com fuso, ex.: 2026-11-05T18:00:00-03:00` })
    .transform((value) => new Date(value));

export const createLotSchema = z
  .object({
    externalId: externalIdSchema,
    // Lance inicial = "valor mínimo" do PDF: o 1º lance precisa ser >= a ele.
    startingPriceCents: centsSchema(100, MAX_CENTS, 'Lance inicial'),
    // Incremento: quanto cada lance seguinte precisa superar o atual. Sem relação obrigatória
    // com o lance inicial (o PDF não pede uma).
    minIncrementCents: centsSchema(100, MAX_CENTS, 'Incremento mínimo'),
    startsAt: isoWithOffset('Início'),
    endsAt: isoWithOffset('Fim'),
    description: z.string().trim().max(2000, 'A descrição pode ter no máximo 2.000 caracteres').optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    // Se um dos horários já veio inválido, o erro dele já foi apontado: não há o que comparar.
    // (Sem esta guarda, o Zod roda esta checagem com o texto cru e o servidor responderia 500.)
    if (!(data.startsAt instanceof Date) || !(data.endsAt instanceof Date)) return;
    const now = Date.now();
    if (data.startsAt.getTime() < now - START_TOLERANCE_MS) {
      ctx.addIssue({ code: 'custom', path: ['startsAt'], message: 'O início não pode estar no passado' });
    }
    const duration = data.endsAt.getTime() - data.startsAt.getTime();
    if (duration <= 0) {
      ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'O fim precisa ser depois do início' });
    } else if (duration < MIN_DURATION_MS) {
      ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'O lote precisa durar pelo menos 2 minutos' });
    } else if (duration > MAX_DURATION_MS) {
      ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'O lote pode durar no máximo 30 dias' });
    }
  });

export const lotListQuerySchema = z
  .object({
    phase: z.enum(PHASES, { error: 'Fase inválida. Use LIVE, SCHEDULED ou ENDED' }).optional(),
  })
  .strict();

// Id de lote é UUID. Qualquer outra coisa é tratada como "não existe" (404), sem 500 do banco.
export const isUuid = (value) => z.uuid().safeParse(value).success;

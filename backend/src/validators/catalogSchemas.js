import { z } from 'zod';

export const catalogSearchSchema = z
  .object({
    q: z
      .string({ error: 'Informe o termo da busca' })
      .trim()
      .min(2, 'A busca precisa ter pelo menos 2 caracteres')
      .max(80, 'A busca pode ter no máximo 80 caracteres'),
  })
  .strict();

// O id da obra no Art Institute é numérico. Validar aqui evita mandar lixo para a API.
export const externalIdSchema = z
  .string({ error: 'Informe o item do catálogo' })
  .regex(/^\d{1,10}$/, 'Item do catálogo inválido');

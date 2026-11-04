import { z } from 'zod';

// .strict(): campo desconhecido é RECUSADO, não ignorado. Assim ninguém manda
// "role": "SELLER" escondido no corpo para escolher o próprio papel.

const email = z
  .string({ error: 'Informe o e-mail' })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'E-mail inválido' }));

// O bcrypt só considera os primeiros 72 bytes da senha; acima disso, o resto seria ignorado
// em silêncio. Melhor recusar do que aceitar uma senha que não é inteira conferida.
const password = z
  .string({ error: 'Informe a senha' })
  .min(8, 'A senha precisa ter pelo menos 8 caracteres')
  .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'A senha pode ter no máximo 72 bytes');

export const registerSchema = z
  .object({
    name: z.string({ error: 'Informe o nome' }).trim().min(2, 'Nome muito curto').max(80, 'Nome muito longo'),
    email,
    password,
    isSeller: z.boolean().default(false), // a opção "Sou leiloeiro" do cadastro
  })
  .strict();

export const loginSchema = z
  .object({
    email,
    password: z.string({ error: 'Informe a senha' }).min(1, 'Informe a senha').max(200),
  })
  .strict();

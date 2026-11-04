import { ZodError } from 'zod';
import { AppError } from '../errors/AppError.js';

// Campo desconhecido (recusado pelo .strict()) ganha mensagem em português.
function toFieldError(issue) {
  if (issue.code === 'unrecognized_keys') {
    return { field: issue.path.join('.'), message: `Campo não permitido: ${issue.keys.join(', ')}` };
  }
  return { field: issue.path.join('.'), message: issue.message };
}

// Rota que não existe: mesmo formato de erro do resto da API.
export function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Não encontrado' } });
}

// Middleware de erro do Express (4 parâmetros). Registrado por ÚLTIMO no app.js.
// Nunca devolve stack trace: o detalhe vai para o log do servidor, não para o cliente.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.details !== undefined && { details: err.details }) },
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Dados inválidos',
        details: err.issues.map(toFieldError),
      },
    });
  }

  // Erros do próprio express.json().
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'O corpo da requisição não é um JSON válido' } });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'O corpo da requisição é grande demais' } });
  }

  console.error(err);
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erro interno. Tente novamente em instantes.' } });
}

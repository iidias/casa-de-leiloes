// Erros de domínio. O errorHandler transforma cada um na resposta
// { error: { code, message, details } } com o status certo.

export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// 400: entrada malformada (o errorHandler também usa para erros do Zod).
export class ValidationError extends AppError {
  constructor(message = 'Dados inválidos', details) {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}

// 401: sem token, token inválido ou expirado.
export class UnauthorizedError extends AppError {
  constructor(message = 'Não autenticado') {
    super(401, 'UNAUTHORIZED', message);
  }
}

// 403: SÓ para papel errado (ex.: leiloeiro tentando dar lance).
// Recurso de outra pessoa NUNCA usa 403: usa NotFoundError, para não confirmar
// que o recurso existe (docs/SECURITY.md).
export class ForbiddenError extends AppError {
  constructor(message = 'Acesso negado') {
    super(403, 'FORBIDDEN', message);
  }
}

// 404: não existe OU não é seu. A resposta é a mesma nos dois casos.
export class NotFoundError extends AppError {
  constructor(message = 'Não encontrado') {
    super(404, 'NOT_FOUND', message);
  }
}

// 409: conflito de estado (ex.: cancelar lote que já tem lance).
export class ConflictError extends AppError {
  constructor(message, code = 'CONFLICT', details) {
    super(409, code, message, details);
  }
}

// Lance recusado por regra de negócio. Os códigos são os motivos do PDF
// (tarefa 56): LOT_NOT_STARTED, LOT_ENDED e ALREADY_WINNING respondem 409;
// BELOW_MINIMUM e INSUFFICIENT_BALANCE respondem 422.
const BID_STATUS = {
  LOT_NOT_STARTED: 409,
  LOT_ENDED: 409,
  ALREADY_WINNING: 409,
  BELOW_MINIMUM: 422,
  INSUFFICIENT_BALANCE: 422,
};

export class BidRejectedError extends AppError {
  constructor(code, message, details) {
    if (!(code in BID_STATUS)) throw new Error(`Código de recusa de lance desconhecido: ${code}`);
    super(BID_STATUS[code], code, message, details);
  }
}

// 502: a API externa (Art Institute) falhou, demorou ou respondeu algo inesperado.
// Só a busca de itens e a criação de lote dependem dela (tarefa 39).
export class ExternalServiceError extends AppError {
  constructor(message = 'Catálogo indisponível no momento. Os lotes já criados continuam funcionando.') {
    super(502, 'CATALOG_UNAVAILABLE', message);
  }
}

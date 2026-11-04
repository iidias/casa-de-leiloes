import { UnauthorizedError } from '../errors/AppError.js';
import { verifyToken } from '../services/authService.js';

// Lê "Authorization: Bearer <token>", confere a assinatura e coloca { sub, role } em req.user.
// Sem token ou token inválido → 401.
export function auth(req, res, next) {
  const header = req.get('authorization') ?? '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw new UnauthorizedError('Faça login para continuar');
  }

  req.user = verifyToken(token);
  next();
}

import { ForbiddenError } from '../errors/AppError.js';

// Autenticação é "quem é você" (auth). Autorização é "você pode fazer isso?" (aqui).
// Uso: router.post('/lots/:id/bids', auth, requireRole('BIDDER'), ...)
// Papel errado → 403. Recurso de outra pessoa NÃO passa por aqui: é 404 no service.
export const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new ForbiddenError('Seu tipo de conta não pode fazer esta ação');
    }
    next();
  };

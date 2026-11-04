import { rateLimit, ipKeyGenerator } from 'express-rate-limit';

// Limites da tarefa 29. Os de depósito e lance contam por usuário logado
// (o middleware auth roda antes e preenche req.user); sem usuário, contam por IP.

const tooMany = (message) => (req, res) => {
  res.status(429).json({ error: { code: 'TOO_MANY_REQUESTS', message } });
};

const byUserOrIp = (req) => req.user?.sub ?? ipKeyGenerator(req.ip);

export const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: tooMany('Muitas tentativas de login. Aguarde um minuto e tente de novo.'),
});

// Cadastro: como ele avisa "e-mail já cadastrado", sem limite daria para testar milhares
// de e-mails e descobrir quem tem conta. Mesmo limite do login, por IP.
export const registerLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: tooMany('Muitas tentativas de cadastro. Aguarde um minuto e tente de novo.'),
});

export const depositLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: byUserOrIp,
  handler: tooMany('Muitos depósitos em pouco tempo. Aguarde um minuto.'),
});

export const bidLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: byUserOrIp,
  handler: tooMany('Muitos lances em pouco tempo. Aguarde alguns segundos.'),
});

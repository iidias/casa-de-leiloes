import { Router } from 'express';
import { auth } from '../middlewares/auth.js';
import { loginLimiter, registerLimiter } from '../middlewares/rateLimit.js';
import { getMe, login, register } from '../services/authService.js';
import { loginSchema, registerSchema } from '../validators/authSchemas.js';

const router = Router();

// Cadastro: padrão BIDDER; com "isSeller": true, SELLER.
router.post('/register', registerLimiter, async (req, res) => {
  const data = registerSchema.parse(req.body);
  const result = await register(data);
  res.status(201).json(result);
});

router.post('/login', loginLimiter, async (req, res) => {
  const data = loginSchema.parse(req.body);
  const result = await login(data);
  res.json(result);
});

router.get('/me', auth, async (req, res) => {
  const user = await getMe(req.user.sub);
  res.json({ user });
});

export default router;

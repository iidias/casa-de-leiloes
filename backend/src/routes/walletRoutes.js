import { Router } from 'express';
import { auth } from '../middlewares/auth.js';
import { depositLimiter } from '../middlewares/rateLimit.js';
import { requireRole } from '../middlewares/requireRole.js';
import { deposit, getWallet } from '../services/walletService.js';
import { depositSchema } from '../validators/walletSchemas.js';

const router = Router();

router.use(auth);

// Licitante e leiloeiro têm carteira: no leiloeiro, é onde entra o valor dos arremates.
router.get('/', async (req, res) => {
  res.json(await getWallet(req.user.sub));
});

// Só o licitante deposita (tarefa 51).
router.post('/deposits', requireRole('BIDDER'), depositLimiter, async (req, res) => {
  const { amountCents } = depositSchema.parse(req.body);
  res.status(201).json(await deposit(req.user.sub, amountCents));
});

export default router;

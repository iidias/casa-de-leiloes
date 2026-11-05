import { Router } from 'express';
import { auth } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/requireRole.js';
import { getMyReceipt, listMyBids, listMyWins, rotateShareLink } from '../services/meService.js';

// Meus lances e arremates (tarefas 71 e 72). Só o licitante. Comprovante de outra pessoa → 404.
const router = Router();

router.use(auth, requireRole('BIDDER'));

router.get('/bids', async (req, res) => {
  res.json(await listMyBids(req.user.sub));
});

router.get('/wins', async (req, res) => {
  res.json(await listMyWins(req.user.sub));
});

router.get('/receipts/:id', async (req, res) => {
  res.json(await getMyReceipt(req.user.sub, req.params.id));
});

// Gera um link novo; o anterior para de funcionar na hora.
router.post('/receipts/:id/share-link', async (req, res) => {
  res.json(await rotateShareLink(req.user.sub, req.params.id));
});

export default router;

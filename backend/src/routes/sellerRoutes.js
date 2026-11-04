import { Router } from 'express';
import { auth } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/requireRole.js';
import { cancelLot, createLot, getSellerLot, listSellerLots } from '../services/lotService.js';
import { createLotSchema } from '../validators/lotSchemas.js';

// Painel do leiloeiro. Lote de outro leiloeiro responde 404 (nunca 403).
const router = Router();

router.use(auth, requireRole('SELLER'));

router.post('/lots', async (req, res) => {
  const data = createLotSchema.parse(req.body);
  const lot = await createLot(req.user.sub, data);
  res.status(201).json({ lot });
});

router.get('/lots', async (req, res) => {
  res.json(await listSellerLots(req.user.sub));
});

router.get('/lots/:id', async (req, res) => {
  res.json(await getSellerLot(req.user.sub, req.params.id));
});

router.post('/lots/:id/cancel', async (req, res) => {
  res.json(await cancelLot(req.user.sub, req.params.id));
});

export default router;

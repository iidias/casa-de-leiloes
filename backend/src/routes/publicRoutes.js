import { Router } from 'express';
import { getPublicReceipt } from '../services/meService.js';

// Comprovante compartilhado por link (tarefa 73). Sem login.
const router = Router();

router.get('/receipts/:token', async (req, res) => {
  // O link é uma credencial de leitura: nada de cache em proxies compartilhados.
  res.set('Cache-Control', 'no-store');
  res.json(await getPublicReceipt(req.params.token));
});

export default router;

import { Router } from 'express';
import { NotFoundError } from '../errors/AppError.js';
import { auth } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/requireRole.js';
import { getArtwork, searchArtworks } from '../services/aicService.js';
import { catalogSearchSchema, externalIdSchema } from '../validators/catalogSchemas.js';

// Busca de itens na API externa: só o leiloeiro usa (tarefa 40).
// É a ÚNICA parte do sistema que pode falhar com a API fora do ar (502 amigável).
const router = Router();

router.use(auth, requireRole('SELLER'));

router.get('/search', async (req, res) => {
  const { q } = catalogSearchSchema.parse(req.query);
  const items = await searchArtworks(q);
  res.json({ items });
});

router.get('/:externalId', async (req, res) => {
  const parsed = externalIdSchema.safeParse(req.params.externalId);
  if (!parsed.success) throw new NotFoundError('Item não encontrado no catálogo');
  const item = await getArtwork(parsed.data);
  if (!item) throw new NotFoundError('Item não encontrado no catálogo');
  res.json({ item });
});

export default router;

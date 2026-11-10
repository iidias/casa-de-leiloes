import { Router } from 'express';
import { NotFoundError } from '../errors/AppError.js';
import { auth } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/requireRole.js';
import { downloadImage, getArtwork, searchArtworks } from '../services/aicService.js';
import { catalogSearchSchema, externalIdSchema } from '../validators/catalogSchemas.js';

// Busca de itens na API externa: só o leiloeiro usa (tarefa 40).
// É a ÚNICA parte do sistema que pode falhar com a API fora do ar (502 amigável).
const router = Router();

// Prévia da obra para o <img> da busca. Fica ANTES do auth porque <img> não envia token.
// O servidor de imagens do AIC recusa (403) o navegador, então o backend busca com o AIC-User-Agent
// e repassa os bytes. O id é numérico e a obra é buscada na API (cache), então não vira proxy aberto.
router.get('/:externalId/image', async (req, res) => {
  const parsed = externalIdSchema.safeParse(req.params.externalId);
  if (!parsed.success) throw new NotFoundError('Item não encontrado no catálogo');
  const item = await getArtwork(parsed.data);
  if (!item) throw new NotFoundError('Item não encontrado no catálogo');
  const image = await downloadImage(item.imageUrl);
  res.set({
    'Content-Type': image.mimeType,
    'Cache-Control': 'public, max-age=86400',
    'Cross-Origin-Resource-Policy': 'cross-origin', // o front fica em outro domínio
  });
  res.send(image.bytes);
});

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

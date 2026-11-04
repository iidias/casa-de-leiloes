import { Router } from 'express';
import { getLotImage, getPublicLot, listLots } from '../services/lotService.js';
import { lotListQuerySchema } from '../validators/lotSchemas.js';

// Rotas públicas, sem login: vitrine, sala (leitura) e imagem.
// Nenhuma depende da API externa: tudo sai do snapshot gravado no banco (tarefa 41).
const router = Router();

router.get('/', async (req, res) => {
  const { phase } = lotListQuerySchema.parse(req.query);
  res.json(await listLots(phase));
});

router.get('/:id', async (req, res) => {
  res.json(await getPublicLot(req.params.id));
});

router.get('/:id/image', async (req, res) => {
  const image = await getLotImage(req.params.id);
  res.set({
    'Content-Type': image.mimeType,
    'Cache-Control': 'public, max-age=86400',
    // O helmet bloqueia por padrão o uso do recurso por outra origem; o front (outro domínio) precisa da imagem.
    'Cross-Origin-Resource-Policy': 'cross-origin',
  });
  res.send(image.bytes);
});

export default router;

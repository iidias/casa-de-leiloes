import { Router } from 'express';
import { ForbiddenError } from '../errors/AppError.js';
import { auth } from '../middlewares/auth.js';
import { bidLimiter } from '../middlewares/rateLimit.js';
import { requireRole } from '../middlewares/requireRole.js';
import { getLotAudit } from '../services/auditService.js';
import { placeBid } from '../services/bidService.js';
import { getLotImage, getPublicLot, listLots } from '../services/lotService.js';
import { bidSchema, idempotencyKeySchema } from '../validators/bidSchemas.js';
import { lotListQuerySchema } from '../validators/lotSchemas.js';

// Rotas públicas, sem login: vitrine, sala (leitura), imagem e auditoria.
// Nenhuma depende da API externa: tudo sai do snapshot gravado no banco (tarefa 41).
// A única rota com login aqui é a do lance.
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

// Auditoria pública, sem login (tarefa 64).
router.get('/:id/audit', async (req, res) => {
  res.json(await getLotAudit(req.params.id));
});

// Leiloeiro não dá lance (PDF, pág. 2), em nenhum lote. Mensagem própria, antes de qualquer outra checagem.
const sellerCannotBid = (req, res, next) => {
  if (req.user.role === 'SELLER') throw new ForbiddenError('Leiloeiros não podem dar lances');
  next();
};

// Lance (tarefa 60). As recusas seguem a ordem da tarefa 56 e têm um código para cada motivo do PDF.
router.post('/:id/bids', auth, sellerCannotBid, requireRole('BIDDER'), bidLimiter, async (req, res) => {
  const { amountCents } = bidSchema.parse(req.body);
  const idempotencyKey = idempotencyKeySchema.parse(req.get('idempotency-key') ?? undefined);
  const { replayed, ...result } = await placeBid({ lotId: req.params.id, userId: req.user.sub, amountCents, idempotencyKey });
  // Repetição com a mesma Idempotency-Key: devolve o mesmo lance, com 200 em vez de 201.
  if (replayed) res.set('Idempotent-Replayed', 'true');
  res.status(replayed ? 200 : 201).json(result);
  // O aviso em tempo real (SSE) entra na tarefa 75, sempre DEPOIS do commit.
});

export default router;

import { Router } from 'express';
import { BidRejectedError, ForbiddenError, NotFoundError } from '../errors/AppError.js';
import { canSubscribe, publish, send, subscribe } from '../lib/events.js';
import prisma from '../lib/prisma.js';
import { auth } from '../middlewares/auth.js';
import { bidLimiter } from '../middlewares/rateLimit.js';
import { requireRole } from '../middlewares/requireRole.js';
import { getLotAudit } from '../services/auditService.js';
import { placeBid } from '../services/bidService.js';
import { getLotImage, getPublicLot, listLots } from '../services/lotService.js';
import { getMyStanding } from '../services/meService.js';
import { settleIfDue } from '../services/settlementService.js';
import { bidSchema, idempotencyKeySchema } from '../validators/bidSchemas.js';
import { isUuid, lotListQuerySchema } from '../validators/lotSchemas.js';

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
  let outcome;
  try {
    outcome = await placeBid({ lotId: req.params.id, userId: req.user.sub, amountCents, idempotencyKey });
  } catch (err) {
    // Lance num lote que já passou do fim: aproveita para liquidar (liquidação preguiçosa, tarefa 68).
    if (err instanceof BidRejectedError && err.code === 'LOT_ENDED') await settleIfDue(req.params.id.toLowerCase());
    throw err;
  }
  const { replayed, extended, ...result } = outcome;
  // Repetição com a mesma Idempotency-Key: devolve o mesmo lance, com 200 em vez de 201.
  if (replayed) res.set('Idempotent-Replayed', 'true');
  res.status(replayed ? 200 : 201).json(result);

  // Tempo real (tarefa 75), sempre DEPOIS do commit. Só apelidos, nunca quem é a pessoa.
  if (!replayed) {
    const { lot, bid } = result;
    publish(lot.id, 'bid', {
      seq: bid.seq,
      alias: bid.alias,
      amountCents: bid.amountCents,
      createdAt: bid.createdAt,
      currentPriceCents: lot.currentPriceCents,
      minNextBidCents: lot.minNextBidCents,
      bidCount: lot.bidCount,
      endsAt: lot.endsAt,
      leaderAlias: lot.leaderAlias,
    });
    if (extended) publish(lot.id, 'extended', { endsAt: lot.endsAt });
  }
});

// Minha situação no lote (tarefa 76): apelido, posição e se estou ganhando. Só licitante.
router.get('/:id/me', auth, requireRole('BIDDER'), async (req, res) => {
  res.json(await getMyStanding(req.params.id, req.user.sub));
});

// Tempo real da sala (tarefa 75): Server-Sent Events, público e sem login.
// Eventos: bid, extended, settled, cancelled. Todos com serverNow.
// Ao conectar (ou reconectar), o front busca GET /lots/:id de novo: o SSE não reenvia o que se perdeu.
router.get('/:id/stream', async (req, res) => {
  if (!isUuid(req.params.id)) throw new NotFoundError('Lote não encontrado');
  const lot = await prisma.lot.findFirst({ where: { id: req.params.id, status: { not: 'CANCELLED' } }, select: { id: true } });
  if (!lot) throw new NotFoundError('Lote não encontrado');
  if (!canSubscribe(req.ip)) {
    return res.status(503).json({ error: { code: 'TRY_AGAIN', message: 'Muitas salas abertas agora. Feche alguma aba ou tente de novo.' } });
  }

  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // proxies não seguram os eventos
  });
  res.flushHeaders();
  res.write('retry: 3000\n\n'); // o navegador tenta reconectar em 3 s se cair
  send(res, 'ready', { lotId: lot.id });

  const unsubscribe = subscribe(lot.id, res, req.ip);
  // Comentário a cada 25 s: proxies derrubam conexão parada.
  const ping = setInterval(() => res.write(':ping\n\n'), 25_000);
  req.on('close', () => {
    clearInterval(ping);
    unsubscribe();
  });
});

export default router;

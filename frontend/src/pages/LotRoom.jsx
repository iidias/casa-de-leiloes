// Sala do lote (tarefas 88 e 89). PDF, pág. 3: lance atual, histórico de lances,
// posição do usuário nos lances, contagem regressiva e um indicador claro de
// "você está ganhando" / "você foi superado", tudo atualizado sem recarregar a página.
// Visual do protótipo do Figma Make (docs/design, LiveLot.tsx).
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Clock3, Gavel, ImageOff, LockKeyhole, LogIn, Plus, Radio, ShieldCheck, Trophy, Wifi } from 'lucide-react';
import { buildUrl } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import useLotRoom from '../hooks/useLotRoom.js';
import useServerNow from '../hooks/useServerNow.js';
import { formatDateTime } from '../lib/format.js';
import { formatBRL } from '../lib/money.js';
import Alert from '../components/Alert.jsx';
import Badge, { PhaseBadge } from '../components/Badge.jsx';
import Button, { ButtonLink } from '../components/Button.jsx';
import Card from '../components/Card.jsx';
import Countdown from '../components/Countdown.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ErrorState from '../components/ErrorState.jsx';
import Skeleton from '../components/Skeleton.jsx';
import BidForm from '../components/room/BidForm.jsx';
import BidHistory from '../components/room/BidHistory.jsx';

const EXTENSION_WINDOW_MS = 2 * 60 * 1000;
const CLOSING_POLL_MS = 4000;

// Fase pelo relógio do servidor: o lote vira "ao vivo" e "encerrando" sozinho, sem recarregar.
// "CLOSING" = o tempo acabou e o servidor ainda vai liquidar (o encerrador roda a cada 5 s).
function phaseAt(lot, now) {
  if (lot.phase === 'ENDED' || lot.result) return 'ENDED';
  if (now < Date.parse(lot.startsAt)) return 'SCHEDULED';
  if (now < Date.parse(lot.endsAt)) return 'LIVE';
  return 'CLOSING';
}

const ordinal = (n) => `${n}º`;

export default function LotRoomPage() {
  const { id } = useParams();
  // Cada lote monta uma sala nova: nada do lote anterior fica na tela.
  return <LotRoom key={id} lotId={id} />;
}

function LotRoom({ lotId }) {
  const room = useLotRoom(lotId);
  const { lot, status, loadError, me, connection, freshSeqs, extendedAt, isBidder, loadLot, loadMe, applyBid, refreshAll } = room;
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const now = useServerNow();
  const formRef = useRef(null);
  const [imageFailed, setImageFailed] = useState(false);

  const phase = lot ? phaseAt(lot, now) : null;

  // Acabou o tempo: confere até o resultado chegar (o SSE "settled" costuma chegar antes).
  useEffect(() => {
    if (phase !== 'CLOSING') return undefined;
    const timer = setInterval(loadLot, CLOSING_POLL_MS);
    return () => clearInterval(timer);
  }, [phase, loadLot]);

  if (status === 'loading') return <RoomSkeleton />;
  if (status === 'notfound' || status === 'cancelled') {
    return (
      <div className="page content">
        <Card>
          <EmptyState
            icon={Gavel}
            title={status === 'cancelled' ? 'Este lote foi cancelado' : 'Lote não encontrado'}
            action={<ButtonLink to="/">Voltar para os lotes</ButtonLink>}
          >
            {status === 'cancelled'
              ? 'O leiloeiro cancelou este lote antes de qualquer lance. Ele não aparece mais na vitrine.'
              : 'Este lote não existe ou foi cancelado.'}
          </EmptyState>
        </Card>
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div className="page content">
        <Card>
          <ErrorState title="Não foi possível abrir a sala" message={loadError?.message} onRetry={refreshAll} />
        </Card>
      </div>
    );
  }

  const isSeller = isAuthenticated && user.role === 'SELLER';
  const remaining = Date.parse(lot.endsAt) - now;
  const lastMinutes = phase === 'LIVE' && remaining < EXTENSION_WINDOW_MS;
  const justExtended = now - extendedAt < 6000;
  const participated = Boolean(me?.alias);
  const result = lot.result;

  const onAccepted = (response) => {
    applyBid(response.bid, response.lot);
    loadMe();
  };
  const onRejected = (err) => {
    // O servidor recusou porque algo mudou: traz o lote e a posição de novo.
    if (['BELOW_MINIMUM', 'LOT_ENDED', 'LOT_NOT_STARTED', 'NOT_FOUND'].includes(err.code)) loadLot();
    if (err.code === 'ALREADY_WINNING') loadMe();
  };
  const goToForm = () => {
    document.getElementById('form-lance')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    formRef.current?.fillMinimum();
  };

  return (
    <div className="page content live-page">
      <div className="live-toolbar">
        <Link to="/" className="back-link">
          <ArrowLeft size={15} aria-hidden="true" /> Voltar para os lotes
        </Link>
      </div>

      <div className="live-layout">
        <div className="art-column">
          <Card className="art-frame">
            {imageFailed ? (
              <ImageOff size={40} className="text-[var(--color-muted)]" aria-label="Imagem indisponível" />
            ) : (
              <img className="artwork-image" src={buildUrl(lot.imageUrl)} alt={lot.title} onError={() => setImageFailed(true)} />
            )}
          </Card>
          <div className="art-info">
            <span className="eyebrow">Obra em leilão</span>
            <h1>{lot.title}</h1>
            <p className="artist">{[lot.artist, lot.dateDisplay].filter(Boolean).join(' · ')}</p>
            <dl>
              <div>
                <dt>Técnica</dt>
                <dd>{lot.medium || '—'}</dd>
              </div>
              <div>
                <dt>Dimensões</dt>
                <dd>{lot.dimensions || '—'}</dd>
              </div>
              <div>
                <dt>Acervo</dt>
                <dd>Art Institute of Chicago</dd>
              </div>
            </dl>
            {lot.description && <p className="description">{lot.description}</p>}
            <ButtonLink to={`/lotes/${lot.id}/auditoria`} variant="ghost" size="sm" icon={ShieldCheck}>
              Auditar este lote
            </ButtonLink>
          </div>
        </div>

        <aside className="auction-column" aria-label="Disputa">
          {connection === 'reconnecting' && phase !== 'ENDED' && (
            <Alert tone="warning">
              <span className="inline-flex items-center gap-1.5">
                <Wifi size={16} aria-hidden="true" /> Reconectando… Os dados serão atualizados automaticamente.
              </span>
            </Alert>
          )}
          {me?.won && (
            <Alert tone="success" action={<ButtonLink to="/meus-lances" size="sm" variant="outline">Ver comprovante</ButtonLink>}>
              <strong>Você arrematou este lote.</strong> O comprovante está em Meus lances.
            </Alert>
          )}

          <Card className="auction-panel">
            <div className="auction-heading">
              {phase === 'CLOSING' ? <Badge tone="neutral">Encerrando</Badge> : <PhaseBadge phase={phase} />}
              <span>
                <Radio size={14} aria-hidden="true" />
                {connection === 'open' ? 'atualizações em tempo real' : 'conectando…'}
              </span>
            </div>

            <CurrentBid lot={lot} phase={phase} result={result} />

            {(phase === 'LIVE' || phase === 'SCHEDULED') && (
              <div className={`countdown-panel ${lastMinutes ? 'critical' : 'normal'}`}>
                <div>
                  <span>{phase === 'SCHEDULED' ? 'Abre em' : 'Encerra em'}</span>
                  <strong>
                    {phase === 'SCHEDULED' ? (
                      <Countdown to={lot.startsAt} urgentBelowMs={0} onEnd={loadLot} />
                    ) : (
                      <Countdown to={lot.endsAt} onEnd={loadLot} endedLabel="Encerrando…" />
                    )}
                  </strong>
                </div>
                {phase === 'LIVE' && justExtended && (
                  <Badge tone="danger">
                    <Plus size={12} aria-hidden="true" /> 2:00
                  </Badge>
                )}
                {lastMinutes && (
                  <p>
                    <Clock3 size={15} aria-hidden="true" /> Cada lance agora acrescenta 2 minutos ao contador.
                  </p>
                )}
              </div>
            )}
            {phase === 'CLOSING' && (
              <div className="countdown-panel">
                <div>
                  <span>Encerrado</span>
                  <strong>Apurando o resultado…</strong>
                </div>
              </div>
            )}

            {isBidder && participated && phase === 'LIVE' && (
              me.isLeading ? (
                <div className="bid-status winning" role="status">
                  <Check size={20} aria-hidden="true" />
                  <div>
                    <strong>Você está ganhando</strong>
                    <span>
                      Você está em {ordinal(me.position)} de {me.totalBidders} {me.totalBidders === 1 ? 'licitante' : 'licitantes'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="bid-status outbid" role="status">
                  <Gavel size={20} aria-hidden="true" />
                  <div>
                    <strong>Você foi superado</strong>
                    <span>
                      Você está em {ordinal(me.position)} de {me.totalBidders} licitantes
                    </span>
                  </div>
                  <Button variant="outline" size="sm" onClick={goToForm}>
                    Cobrir com {formatBRL(lot.minNextBidCents)}
                  </Button>
                </div>
              )
            )}

            {phase === 'LIVE' && isBidder && <BidForm ref={formRef} lot={lot} onAccepted={onAccepted} onRejected={onRejected} />}

            {phase === 'SCHEDULED' && isBidder && (
              <div className="bid-form">
                <Alert tone="info">Este lote abre em {formatDateTime(lot.startsAt)}. O formulário libera sozinho na hora.</Alert>
                <Button size="lg" className="full-button" disabled>
                  Aguardar abertura
                </Button>
              </div>
            )}

            {(phase === 'LIVE' || phase === 'SCHEDULED') && isSeller && (
              <div className="bid-form">
                <Alert tone="info">
                  <span className="inline-flex items-center gap-1.5">
                    <LockKeyhole size={16} aria-hidden="true" /> Leiloeiros não podem dar lances.
                  </span>
                </Alert>
              </div>
            )}

            {(phase === 'LIVE' || phase === 'SCHEDULED') && !isAuthenticated && (
              <div className="access-panel">
                <LogIn size={22} aria-hidden="true" />
                <div>
                  <strong>Entre para dar lances</strong>
                  <span>Você pode acompanhar a disputa sem uma conta.</span>
                </div>
                <Button onClick={() => navigate('/login', { state: { from: location } })}>Entrar</Button>
              </div>
            )}
          </Card>
        </aside>
      </div>

      <BidHistory bids={lot.bids} myAlias={me?.alias} freshSeqs={freshSeqs} startingPriceCents={lot.startingPriceCents} />

      {phase === 'LIVE' && isBidder && (
        <div className="mobile-bid-bar">
          <div>
            <span>Lance atual</span>
            <strong>{formatBRL(lot.bidCount ? lot.currentPriceCents : lot.startingPriceCents)}</strong>
          </div>
          <div>
            <span>Encerra em</span>
            <strong>
              <Countdown to={lot.endsAt} endedLabel="Encerrando…" />
            </strong>
          </div>
          <Button onClick={goToForm}>Dar lance</Button>
        </div>
      )}
    </div>
  );
}

// Bloco do valor grande no topo do painel, conforme a fase.
function CurrentBid({ lot, phase, result }) {
  if (phase === 'ENDED') {
    if (result?.sold) {
      return (
        <div className="current-bid">
          <span>Lote arrematado</span>
          <strong className="money">{formatBRL(result.finalPriceCents)}</strong>
          <small className="inline-flex items-center justify-center gap-1.5">
            <Trophy size={14} aria-hidden="true" /> Arrematado por {result.winnerAlias}
          </small>
        </div>
      );
    }
    if (result && !result.settled) {
      return (
        <div className="current-bid ended-summary">
          <span>Resultado</span>
          <strong>Apurando…</strong>
          <small>O resultado aparece aqui em instantes.</small>
        </div>
      );
    }
    return (
      <div className="current-bid ended-summary">
        <span>Resultado</span>
        <strong>Encerrado sem lances</strong>
        <small>Nenhum vencedor</small>
      </div>
    );
  }
  if (phase === 'SCHEDULED' || !lot.bidCount) {
    return (
      <div className="current-bid">
        <span>Lance inicial</span>
        <strong className="money">{formatBRL(lot.startingPriceCents)}</strong>
        <small>{phase === 'SCHEDULED' ? 'A disputa ainda não começou' : 'Nenhum lance ainda. Seja o primeiro.'}</small>
      </div>
    );
  }
  return (
    <div className="current-bid">
      <span>Lance atual</span>
      <strong className="money">{formatBRL(lot.currentPriceCents)}</strong>
      <small>
        por {lot.leaderAlias} · {lot.bidCount} {lot.bidCount === 1 ? 'lance' : 'lances'}
      </small>
    </div>
  );
}

function RoomSkeleton() {
  return (
    <div className="page content live-page" aria-busy="true" aria-label="Carregando a sala">
      <div className="live-layout">
        <Skeleton className="h-[420px]" />
        <Card className="auction-panel p-6 grid gap-4">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-14 w-3/4 mx-auto" />
          <Skeleton className="h-24" />
          <Skeleton className="h-10" />
          <Skeleton className="h-12" />
        </Card>
      </div>
    </div>
  );
}

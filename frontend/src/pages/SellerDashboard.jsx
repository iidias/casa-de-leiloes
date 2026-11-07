// Painel do leiloeiro (tarefa 94). PDF, pág. 3: "lista dos próprios lotes, fase, possibilidade
// de cancelar antes de qualquer lance, resultados de cada lote encerrado (arrematado? por quanto?)
// e total recebido". Mesma ideia do painel do organizador do meu projeto anterior (ingressos),
// com o visual do protótipo. O botão Cancelar só aparece quando o backend diz que pode (canCancel),
// e o backend confere de novo na hora (um lance pode chegar no mesmo instante).
import { useCallback, useEffect, useState } from 'react';
import { Ban, Clock3, Gavel, ImageOff, Plus, Trophy } from 'lucide-react';
import { api, buildUrl } from '../api/client.js';
import { formatDateTime } from '../lib/format.js';
import { formatBRL } from '../lib/money.js';
import Alert from '../components/Alert.jsx';
import Badge, { PhaseBadge } from '../components/Badge.jsx';
import Button, { ButtonLink } from '../components/Button.jsx';
import Card from '../components/Card.jsx';
import Countdown from '../components/Countdown.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ErrorState from '../components/ErrorState.jsx';
import PageTitle from '../components/PageTitle.jsx';
import Skeleton from '../components/Skeleton.jsx';

const REFRESH_MS = 15000;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export default function SellerDashboard() {
  const [data, setData] = useState(null); // { lots, summary }
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const [lots, summary] = await Promise.all([api.get('/seller/lots'), api.get('/seller/summary')]);
      setData({ lots: lots.lots, summary });
      setError(null);
    } catch (err) {
      setError(err);
    }
  }, []);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- os setState só rodam depois da resposta da API
    load();
    const timer = setInterval(() => {
      if (!document.hidden) load();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const header = (
    <div className="seller-head">
      <PageTitle eyebrow="Painel do leiloeiro" title="Meus lotes">
        Acompanhe seus lotes, cancele os que ainda não receberam lances e veja o resultado de cada encerramento.
      </PageTitle>
      <ButtonLink to="/leiloeiro/novo" icon={Plus}>
        Novo lote
      </ButtonLink>
    </div>
  );

  if (error && !data) {
    return (
      <div className="page content">
        {header}
        <Card>
          <ErrorState title="Não foi possível carregar seus lotes" message={error.message} onRetry={load} />
        </Card>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="page content" aria-busy="true">
        {header}
        <div className="balance-grid">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <div className="activity-list mt-10">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      </div>
    );
  }

  const { lots, summary } = data;
  const running = lots.filter((lot) => lot.phase === 'LIVE' || lot.phase === 'SCHEDULED');
  const ended = lots.filter((lot) => lot.phase === 'ENDED');
  const cancelled = lots.filter((lot) => lot.phase === 'CANCELLED');

  const replaceLot = (updated) =>
    setData((previous) => ({ ...previous, lots: previous.lots.map((lot) => (lot.id === updated.id ? updated : lot)) }));

  return (
    <div className="page content">
      {header}
      {error && (
        <div className="mb-6">
          <Alert tone="warning">Não foi possível atualizar agora. Tentando de novo em instantes.</Alert>
        </div>
      )}

      <div className="balance-grid">
        <Card className="balance-card featured">
          <span>Total recebido</span>
          <strong>{formatBRL(summary.totalReceivedCents)}</strong>
          <small>Soma dos arremates creditados na sua carteira</small>
        </Card>
        <Card className="balance-card">
          <span>Lotes arrematados</span>
          <strong>{summary.soldCount}</strong>
          <small>de {plural(ended.length, 'lote encerrado', 'lotes encerrados')}</small>
        </Card>
        <Card className="balance-card">
          <span>Em andamento</span>
          <strong>{running.length}</strong>
          <small>ao vivo ou agendados</small>
        </Card>
      </div>

      {lots.length === 0 ? (
        <Card className="mt-10">
          <EmptyState icon={Gavel} title="Você ainda não criou nenhum lote" action={<ButtonLink to="/leiloeiro/novo" icon={Plus}>Criar o primeiro lote</ButtonLink>}>
            Busque uma obra no catálogo do Art Institute of Chicago e defina o lance inicial, o incremento e os horários.
          </EmptyState>
        </Card>
      ) : (
        <>
          <section className="my-bids-section seller-section" aria-labelledby="titulo-andamento">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Ao vivo e agendados</span>
                <h2 id="titulo-andamento">Em andamento</h2>
              </div>
              <span>{plural(running.length, 'lote', 'lotes')}</span>
            </div>
            {running.length === 0 ? (
              <Card>
                <p className="px-5 py-6 text-[14px] text-[var(--color-copy)]">Nenhum lote ao vivo ou agendado agora.</p>
              </Card>
            ) : (
              <div className="activity-list">
                {running.map((lot) => (
                  <SellerLotCard key={lot.id} lot={lot} onChanged={replaceLot} onReload={load} />
                ))}
              </div>
            )}
          </section>

          <section className="my-bids-section" aria-labelledby="titulo-resultados">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Encerrados</span>
                <h2 id="titulo-resultados">Resultados</h2>
              </div>
              <span>{plural(summary.soldCount, 'arrematado', 'arrematados')}</span>
            </div>
            {ended.length === 0 ? (
              <Card>
                <p className="px-5 py-6 text-[14px] text-[var(--color-copy)]">
                  Quando um lote encerrar, o resultado aparece aqui: arrematado e por quanto, ou encerrado sem lances.
                </p>
              </Card>
            ) : (
              <div className="activity-list">
                {ended.map((lot) => (
                  <SellerLotCard key={lot.id} lot={lot} />
                ))}
              </div>
            )}
          </section>

          {cancelled.length > 0 && (
            <section className="my-bids-section" aria-labelledby="titulo-cancelados">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Fora da vitrine</span>
                  <h2 id="titulo-cancelados">Cancelados</h2>
                </div>
                <span>{plural(cancelled.length, 'lote', 'lotes')}</span>
              </div>
              <div className="activity-list">
                {cancelled.map((lot) => (
                  <SellerLotCard key={lot.id} lot={lot} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function SellerLotCard({ lot, onChanged, onReload }) {
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [message, setMessage] = useState(null);
  const [imageFailed, setImageFailed] = useState(false);

  async function cancel() {
    if (!confirming) {
      setConfirming(true);
      setMessage(null);
      return;
    }
    setCancelling(true);
    try {
      const result = await api.post(`/seller/lots/${lot.id}/cancel`);
      onChanged(result.lot);
    } catch (err) {
      // Ex.: o primeiro lance chegou antes do cancelamento. Mostra o motivo e traz o lote atualizado.
      setMessage(err.message);
      onReload?.();
    } finally {
      setCancelling(false);
      setConfirming(false);
    }
  }

  const result = lot.result;
  let outcome = null;
  if (lot.phase === 'ENDED') {
    if (!result?.settled) outcome = <Badge tone="neutral">Apurando o resultado</Badge>;
    else if (result.sold) outcome = (
      <Badge tone="success">
        <Trophy size={12} aria-hidden="true" /> Arrematado
      </Badge>
    );
    else outcome = <Badge tone="neutral">Encerrado sem lances</Badge>;
  }

  return (
    <Card as="article" className="seller-lot">
      {lot.imageUrl && !imageFailed ? (
        <img className="artwork-image" src={buildUrl(lot.imageUrl)} alt={lot.title} loading="lazy" onError={() => setImageFailed(true)} />
      ) : (
        <div className="seller-lot-noimage">
          {lot.phase === 'CANCELLED' ? <Ban size={24} aria-label="Lote cancelado" /> : <ImageOff size={24} aria-label="Imagem indisponível" />}
        </div>
      )}

      <div className="activity-main">
        <PhaseBadge phase={lot.phase} />
        <h3 title={lot.title}>{lot.title}</h3>
        <p>{lot.artist ?? 'Artista desconhecido'}</p>
      </div>

      {lot.phase === 'ENDED' ? (
        <>
          <div className="activity-stat">
            <span>Resultado</span>
            {result?.sold ? (
              <strong>
                {formatBRL(result.finalPriceCents)} <small>· {result.winnerAlias}</small>
              </strong>
            ) : (
              <strong className="text-[var(--color-muted)]">{result?.settled ? 'Sem vencedor' : '—'}</strong>
            )}
          </div>
          <div className="activity-stat">
            <span>Encerrado em</span>
            <strong>{formatDateTime(result?.settledAt ?? lot.endsAt)}</strong>
          </div>
        </>
      ) : lot.phase === 'CANCELLED' ? (
        <>
          <div className="activity-stat">
            <span>Lance inicial</span>
            <strong>{formatBRL(lot.startingPriceCents)}</strong>
          </div>
          <div className="activity-stat">
            <span>Fim previsto</span>
            <strong>{formatDateTime(lot.endsAt)}</strong>
          </div>
        </>
      ) : (
        <>
          <div className="activity-stat">
            <span>{lot.bidCount > 0 ? 'Lance atual' : 'Lance inicial'}</span>
            <strong>
              {formatBRL(lot.bidCount > 0 ? lot.currentPriceCents : lot.startingPriceCents)}{' '}
              <small>· {plural(lot.bidCount, 'lance', 'lances')}</small>
            </strong>
          </div>
          <div className="activity-stat">
            <span>
              <Clock3 size={12} aria-hidden="true" /> {lot.phase === 'SCHEDULED' ? 'Abre em' : 'Termina em'}
            </span>
            <strong>
              <Countdown to={lot.phase === 'SCHEDULED' ? lot.startsAt : lot.endsAt} onEnd={onReload} endedLabel="Atualizando…" />
            </strong>
          </div>
        </>
      )}

      <div className="seller-lot-actions">
        {outcome}
        {lot.phase !== 'CANCELLED' && (
          <ButtonLink to={`/lotes/${lot.id}`} variant="outline" size="sm">
            {lot.phase === 'LIVE' ? 'Abrir sala' : 'Ver lote'}
          </ButtonLink>
        )}
        {lot.canCancel && (lot.phase === 'SCHEDULED' || lot.phase === 'LIVE') && (
          <>
            {confirming && (
              <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={cancelling}>
                Manter
              </Button>
            )}
            <Button variant={confirming ? 'primary' : 'ghost'} size="sm" icon={Ban} loading={cancelling} onClick={cancel}>
              {confirming ? 'Confirmar cancelamento' : 'Cancelar'}
            </Button>
          </>
        )}
      </div>

      {confirming && (
        <div className="seller-lot-note">
          <Alert tone="warning">O lote sai da vitrine e não pode ser reaberto. Só é possível cancelar antes do primeiro lance.</Alert>
        </div>
      )}
      {message && (
        <div className="seller-lot-note">
          <Alert tone="danger">{message}</Alert>
        </div>
      )}
    </Card>
  );
}


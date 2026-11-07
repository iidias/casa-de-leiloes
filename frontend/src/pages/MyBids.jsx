// Meus lances e arremates (tarefa 91). PDF, pág. 3: "os itens em que deu lance e os
// lotes vencidos, com o respectivo comprovante e link de compartilhamento".
// Visual do protótipo do Figma Make (docs/design, MyBids.tsx).
import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Clock3, Copy, ExternalLink, Gavel, Link2, RefreshCw, Trophy } from 'lucide-react';
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

const REFRESH_MS = 15_000;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// O link aponta para o endereço público do site; dentro do app, navega pelo caminho.
function pathOf(url) {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

export default function MyBids() {
  const [data, setData] = useState(null); // { items, wins }
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const [bids, wins] = await Promise.all([api.get('/me/bids'), api.get('/me/wins')]);
      setData({ items: bids.items, wins: wins.wins });
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

  const updateWin = (id, changes) =>
    setData((previous) => ({ ...previous, wins: previous.wins.map((w) => (w.id === id ? { ...w, ...changes } : w)) }));

  const header = (
    <PageTitle eyebrow="Sua atividade" title="Meus lances e arremates">
      Acompanhe as disputas em que você deu lance e compartilhe os comprovantes dos lotes que venceu.
    </PageTitle>
  );

  if (error && !data) {
    return (
      <div className="page content">
        {header}
        <Card>
          <ErrorState title="Não foi possível carregar seus lances" message={error.message} onRetry={load} />
        </Card>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="page content" aria-busy="true">
        {header}
        <div className="activity-list">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      </div>
    );
  }

  const active = data.items.filter((item) => item.lot.phase === 'LIVE');
  const finished = data.items.filter((item) => item.lot.phase === 'ENDED' && !item.won);

  if (data.items.length === 0 && data.wins.length === 0) {
    return (
      <div className="page content">
        {header}
        <Card>
          <EmptyState icon={Gavel} title="Você ainda não deu nenhum lance" action={<ButtonLink to="/">Ver lotes ao vivo</ButtonLink>}>
            Quando você der um lance, a disputa aparece aqui. Os lotes que você vencer ficam com o comprovante e o link.
          </EmptyState>
        </Card>
      </div>
    );
  }

  return (
    <div className="page content">
      {header}
      {error && (
        <div className="mb-6">
          <Alert tone="warning">Não foi possível atualizar agora. Tentando de novo em instantes.</Alert>
        </div>
      )}

      <section className="my-bids-section" aria-labelledby="titulo-andamento">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Em andamento</span>
            <h2 id="titulo-andamento">Disputas ativas</h2>
          </div>
          <span>{plural(active.length, 'lote', 'lotes')}</span>
        </div>
        {active.length === 0 ? (
          <Card>
            <p className="px-5 py-6 text-[14px] text-[var(--color-copy)]">Nenhuma disputa ao vivo com lance seu agora.</p>
          </Card>
        ) : (
          <div className="activity-list">
            {active.map((item) => (
              <ActivityCard key={item.lot.id} item={item} onEnd={load} />
            ))}
          </div>
        )}
      </section>

      <section className="my-bids-section won-section" aria-labelledby="titulo-arrematados">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Concluídos</span>
            <h2 id="titulo-arrematados">Arrematados</h2>
          </div>
          <span>{plural(data.wins.length, 'comprovante', 'comprovantes')}</span>
        </div>
        {data.wins.length === 0 ? (
          <Card>
            <p className="px-5 py-6 text-[14px] text-[var(--color-copy)]">
              Você ainda não arrematou nenhum lote. Quando vencer, o comprovante e o link de compartilhamento aparecem aqui.
            </p>
          </Card>
        ) : (
          <div className="activity-list">
            {data.wins.map((win) => (
              <WonCard key={win.id} win={win} onLinkChanged={(shareUrl) => updateWin(win.id, { shareUrl })} />
            ))}
          </div>
        )}
      </section>

      {finished.length > 0 && (
        <section className="my-bids-section" aria-labelledby="titulo-encerrados">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Encerrados</span>
              <h2 id="titulo-encerrados">Não arrematados</h2>
            </div>
            <span>{plural(finished.length, 'lote', 'lotes')}</span>
          </div>
          <div className="activity-list">
            {finished.map((item) => (
              <ActivityCard key={item.lot.id} item={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ActivityCard({ item, onEnd }) {
  const { lot } = item;
  const live = lot.phase === 'LIVE';
  let badge;
  if (live) badge = item.isLeading ? <Badge tone="success">Ganhando</Badge> : <Badge tone="danger">Superado</Badge>;
  else if (item.lost) badge = <Badge tone="neutral">Não arrematado</Badge>;
  else badge = <Badge tone="neutral">Apurando</Badge>;

  return (
    <Card as="article" className="activity-card">
      <img className="artwork-image" src={buildUrl(lot.imageUrl)} alt={lot.title} loading="lazy" />
      <div className="activity-main">
        <PhaseBadge phase={lot.phase} />
        <h3 title={lot.title}>{lot.title}</h3>
        <p>
          {item.alias}
          {item.position ? ` · ${item.position}º de ${item.totalBidders}` : ''}
        </p>
      </div>
      <div className="activity-stat">
        <span>Meu maior lance</span>
        <strong>{formatBRL(item.myBestBidCents)}</strong>
      </div>
      <div className="activity-stat">
        {live ? (
          <>
            <span>
              <Clock3 size={13} aria-hidden="true" /> Tempo restante
            </span>
            <strong>
              <Countdown to={lot.endsAt} onEnd={onEnd} endedLabel="Encerrando…" />
            </strong>
          </>
        ) : (
          <>
            <span>Valor final</span>
            <strong>{formatBRL(lot.currentPriceCents)}</strong>
          </>
        )}
      </div>
      {badge}
      <ButtonLink to={`/lotes/${lot.id}`} variant="outline" size="sm">
        {live ? 'Abrir sala' : 'Ver lote'}
      </ButtonLink>
    </Card>
  );
}

function WonCard({ win, onLinkChanged }) {
  const inputRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [message, setMessage] = useState(null);

  async function copy() {
    setMessage(null);
    try {
      await navigator.clipboard.writeText(win.shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Sem acesso à área de transferência: seleciona o texto para copiar à mão.
      inputRef.current?.select();
      setMessage({ tone: 'info', text: 'Selecionamos o link. Use Ctrl+C para copiar.' });
    }
  }

  async function rotate() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setRotating(true);
    setMessage(null);
    try {
      const result = await api.post(`/me/receipts/${win.id}/share-link`);
      onLinkChanged(result.shareUrl);
      setMessage({ tone: 'success', text: 'Link novo gerado. O link anterior parou de funcionar.' });
    } catch (err) {
      setMessage({ tone: 'danger', text: err.message });
    } finally {
      setRotating(false);
      setConfirming(false);
    }
  }

  return (
    <Card as="article" className="won-card">
      <div className="won-art">
        <img className="artwork-image" src={buildUrl(win.lot.imageUrl)} alt={win.lot.title} loading="lazy" />
        <span aria-hidden="true">
          <Trophy size={22} />
        </span>
      </div>
      <div className="won-info">
        <Badge tone="success">
          <Check size={12} aria-hidden="true" /> Arrematado
        </Badge>
        <h3>{win.lot.title}</h3>
        <p>{win.lot.artist}</p>
        <p className="mt-2">
          Comprovante nº <span className="font-mono">{win.number}</span> · {formatDateTime(win.issuedAt)}
        </p>
        <div>
          <span>Valor final</span>
          <strong>{formatBRL(win.amountCents)}</strong>
        </div>
      </div>
      <div className="share-panel">
        <label>
          <span>
            <Link2 size={14} aria-hidden="true" /> Link público do comprovante
          </span>
          <div>
            <input ref={inputRef} readOnly value={win.shareUrl ?? ''} onFocus={(e) => e.target.select()} />
            <Button variant="secondary" size="sm" icon={copied ? Check : Copy} onClick={copy}>
              {copied ? 'Copiado' : 'Copiar'}
            </Button>
          </div>
        </label>
        {copied && <Alert tone="success">Link copiado. Ele não mostra seu nome nem seu e-mail.</Alert>}
        {message && <Alert tone={message.tone}>{message.text}</Alert>}
        {confirming && (
          <Alert tone="warning">Gerar um link novo desativa o atual: quem tiver o link antigo não consegue mais abrir.</Alert>
        )}
        <div className="share-actions">
          <ButtonLink to={pathOf(win.shareUrl)} size="sm">
            Ver comprovante <ExternalLink size={14} aria-hidden="true" />
          </ButtonLink>
          <Button variant="ghost" size="sm" icon={RefreshCw} loading={rotating} onClick={rotate}>
            {confirming ? 'Confirmar novo link' : 'Gerar novo link'}
          </Button>
          {confirming && !rotating && (
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

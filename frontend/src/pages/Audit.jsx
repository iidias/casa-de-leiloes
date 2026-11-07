// Auditoria pública do lote (tarefa 93). PDF: "Auditoria: pública, sem login, mostra o histórico
// completo de lances e se está íntegro ou adulterado". Duas camadas (docs/AUDIT.md):
// o servidor confere tudo, inclusive os selos HMAC; o navegador refaz sozinho a cadeia de SHA-256.
// Só apelidos e valores: nenhum dado pessoal. Visual do protótipo do Figma Make (docs/design, Audit.tsx).
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Check, Hash, ImageOff, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react';
import { api, buildUrl } from '../api/client.js';
import { canVerifyInBrowser, verifyChainInBrowser } from '../lib/auditChain.js';
import { formatDateTime, formatTime } from '../lib/format.js';
import { formatBRL } from '../lib/money.js';
import Alert from '../components/Alert.jsx';
import Badge, { PhaseBadge } from '../components/Badge.jsx';
import Button, { ButtonLink } from '../components/Button.jsx';
import Card from '../components/Card.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ErrorState from '../components/ErrorState.jsx';
import Skeleton from '../components/Skeleton.jsx';

const shortHash = (hash) => `${hash.slice(0, 4)}…${hash.slice(-4)}`;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// Números dos lances citados nos problemas do servidor ("Lance #4: ..."), para destacar as linhas.
function seqsIn(messages) {
  const seqs = new Set();
  for (const message of messages) {
    for (const match of message.matchAll(/Lance #(\d+)/g)) seqs.add(Number(match[1]));
  }
  return seqs;
}

export default function AuditPage() {
  const { id } = useParams();
  return <Audit key={id} lotId={id} />;
}

function Audit({ lotId }) {
  const [audit, setAudit] = useState(null);
  const [browser, setBrowser] = useState(null); // { ok, problems } | { unsupported: true }
  const [status, setStatus] = useState('loading'); // loading | ready | notfound | error
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get(`/lots/${encodeURIComponent(lotId)}/audit`, { auth: false });
      const local = canVerifyInBrowser()
        ? await verifyChainInBrowser(data.lot.id, data.genesisHash, data.bids)
        : { unsupported: true };
      setAudit(data);
      setBrowser(local);
      setError(null);
      setStatus('ready');
    } catch (err) {
      setError(err);
      // Falha ao conferir de novo: mantém o último resultado na tela e avisa.
      setStatus((current) => (err.status === 404 ? 'notfound' : current === 'ready' ? current : 'error'));
    }
  }, [lotId]);

  useEffect(() => {
    // oxlint-disable-next-line react-hooks/set-state-in-effect -- busca inicial; o setState acontece depois do await
    load();
  }, [load]);

  async function verifyAgain() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (status === 'loading') return <AuditSkeleton />;
  if (status === 'notfound') {
    return (
      <div className="page content">
        <Card>
          <EmptyState icon={ShieldCheck} title="Auditoria indisponível" action={<ButtonLink to="/">Voltar para os lotes</ButtonLink>}>
            Lote não encontrado. Ele não existe ou foi cancelado.
          </EmptyState>
        </Card>
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div className="page content">
        <Card>
          <ErrorState title="Não foi possível carregar a auditoria" message={error?.message} onRetry={() => { setStatus('loading'); load(); }} />
        </Card>
      </div>
    );
  }

  const { lot, bids, integrity } = audit;
  const browserRan = !browser.unsupported;
  const browserOk = browserRan && browser.ok;
  // Íntegro só quando as duas camadas concordam. O navegador nunca "aprova" sozinho o que o servidor reprovou.
  const valid = integrity.ok && (browserOk || !browserRan);
  const problems = [...integrity.problems, ...(browserRan ? browser.problems.map((p) => `No seu navegador: ${p.message}`) : [])];
  const flagged = new Set([...seqsIn(integrity.problems), ...(browserRan ? browser.problems.map((p) => p.seq) : [])]);
  const newestFirst = [...bids].sort((a, b) => b.seq - a.seq);

  return (
    <div className="page content audit-page">
      <div className="audit-top">
        <Link to={`/lotes/${lot.id}`} className="back-link">
          <ArrowLeft size={15} aria-hidden="true" /> Voltar para a sala
        </Link>
        <Button variant="outline" size="sm" icon={RefreshCw} loading={refreshing} onClick={verifyAgain}>
          Verificar de novo
        </Button>
      </div>

      {error && (
        <Alert tone="warning">Não foi possível conferir de novo agora. {error.message}</Alert>
      )}

      <Card className="audit-lot">
        {imageFailed ? (
          <div className="audit-image-fallback">
            <ImageOff size={24} aria-label="Imagem indisponível" />
          </div>
        ) : (
          <img className="artwork-image" src={buildUrl(`/lots/${lot.id}/image`)} alt={lot.title} onError={() => setImageFailed(true)} />
        )}
        <div>
          <span className="eyebrow">Auditoria pública</span>
          <h1>{lot.title}</h1>
          <p>
            Lance inicial {formatBRL(lot.startingPriceCents)} · incremento {formatBRL(lot.minIncrementCents)} · fim{' '}
            {formatDateTime(lot.endsAt)}
          </p>
        </div>
        <PhaseBadge phase={lot.phase} />
      </Card>

      <div className="audit-summary">
        <div className={`integrity-seal ${valid ? 'valid' : 'invalid'}`} role="status">
          {valid ? <ShieldCheck size={34} aria-hidden="true" /> : <ShieldAlert size={34} aria-hidden="true" />}
          <div>
            <strong>{valid ? 'Íntegro' : 'Adulterado'}</strong>
            <span>
              {valid
                ? `${plural(bids.length, 'lance conferido', 'lances conferidos')}, nenhuma alteração encontrada`
                : 'Foram encontradas inconsistências no histórico'}
            </span>
          </div>
        </div>
        {!browserRan ? (
          <Alert tone="info">
            <strong>Seu navegador não permite a conferência local.</strong> O resultado ao lado é o do servidor.
          </Alert>
        ) : browserOk ? (
          <Alert tone="success">
            <strong>Verificado também no seu navegador.</strong> A cadeia SHA-256 foi recalculada aqui e coincide com o histórico
            publicado.
          </Alert>
        ) : (
          <Alert tone="danger">
            <strong>Falhou no seu navegador.</strong> A cadeia recalculada aqui não coincide com os registros publicados.
          </Alert>
        )}
      </div>

      {problems.length > 0 && (
        <Alert tone="danger">
          <strong>Problemas encontrados</strong>
          <ul className="audit-problems">
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </Alert>
      )}

      <Card className="verification-note">
        {valid ? <ShieldCheck size={24} aria-hidden="true" /> : <AlertCircle size={24} aria-hidden="true" />}
        <div>
          <h3>Verificação em duas camadas</h3>
          <p>
            Seu navegador confere a sequência e o hash de cada lance. O servidor confere também os selos HMAC, feitos com uma
            chave secreta que não fica no banco de dados. Conferido em {formatDateTime(integrity.checkedAt)}.
          </p>
        </div>
        <Badge tone={valid ? 'success' : 'danger'}>
          {valid ? <Check size={12} aria-hidden="true" /> : <AlertCircle size={12} aria-hidden="true" />}{' '}
          {valid ? (browserRan ? '2 de 2 válidas' : 'servidor válido') : 'verificação falhou'}
        </Badge>
      </Card>

      <section className="audit-history" aria-labelledby="audit-history-title">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Cadeia de integridade</span>
            <h2 id="audit-history-title">Histórico completo</h2>
          </div>
          <span>{valid ? plural(bids.length, 'registro verificado', 'registros verificados') : plural(problems.length, 'problema encontrado', 'problemas encontrados')}</span>
        </div>
        <Card className="audit-table">
          <div className="audit-row audit-head" aria-hidden="true">
            <span>Seq.</span>
            <span>Licitante</span>
            <span>Valor</span>
            <span>Horário</span>
            <span>Hash SHA-256</span>
          </div>
          {newestFirst.length === 0 ? (
            <p className="audit-empty">Nenhum lance registrado neste lote.</p>
          ) : (
            <ol>
              {newestFirst.map((bid) => {
                const affected = flagged.has(bid.seq);
                return (
                  <li className={`audit-row ${affected ? 'tampered' : ''}`} key={bid.seq}>
                    <span>
                      {affected && <AlertCircle size={13} aria-label="Com problema" />} #{bid.seq}
                    </span>
                    <strong>Licitante #{bid.alias}</strong>
                    <strong>{formatBRL(bid.amountCents)}</strong>
                    <time dateTime={bid.createdAt} title={formatDateTime(bid.createdAt)}>
                      {formatTime(bid.createdAt)}
                    </time>
                    <code title={bid.hash}>
                      <Hash size={13} aria-hidden="true" /> {shortHash(bid.hash)}
                    </code>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>
      </section>
    </div>
  );
}

function AuditSkeleton() {
  return (
    <div className="page content audit-page" aria-busy="true" aria-label="Carregando a auditoria">
      <Skeleton className="h-28" />
      <div className="audit-summary">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-64 mt-12" />
    </div>
  );
}

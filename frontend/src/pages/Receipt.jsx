// Comprovante público (tarefa 92). Abre pelo link compartilhado, sem login.
// PDF: "comprovante para o vencedor, compartilhável por link", e auditoria e comprovante
// "identificam licitantes sem expor dados pessoais". Aqui só aparece o apelido do vencedor.
// Link forjado, revogado ou inexistente: a mesma página "comprovante não encontrado".
// Visual do protótipo do Figma Make (docs/design, Receipt.tsx).
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertCircle, Check, FileX2, ImageOff, Printer, ShieldAlert, ShieldCheck } from 'lucide-react';
import { api, buildUrl } from '../api/client.js';
import { formatDateTime } from '../lib/format.js';
import { formatBRL } from '../lib/money.js';
import Alert from '../components/Alert.jsx';
import Badge from '../components/Badge.jsx';
import Button, { ButtonLink } from '../components/Button.jsx';
import Card from '../components/Card.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ErrorState from '../components/ErrorState.jsx';
import Logo from '../components/Logo.jsx';
import Skeleton from '../components/Skeleton.jsx';

export default function ReceiptPage() {
  const { token } = useParams();
  return <Receipt key={token} token={token} />;
}

function Receipt({ token }) {
  const [receipt, setReceipt] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | notfound | error
  const [error, setError] = useState(null);
  const [imageFailed, setImageFailed] = useState(false);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      // Rota pública: não manda o token de quem estiver logado.
      const data = await api.get(`/public/receipts/${encodeURIComponent(token)}`, { auth: false });
      setReceipt(data.receipt);
      setStatus('ready');
    } catch (err) {
      setError(err);
      setStatus(err.status === 404 ? 'notfound' : 'error');
    }
  }, [token]);

  useEffect(() => {
    // oxlint-disable-next-line react-hooks/set-state-in-effect -- busca inicial; o setState acontece depois do await
    load();
  }, [load]);

  if (status === 'loading') return <ReceiptSkeleton />;
  if (status === 'notfound') {
    return (
      <div className="page content receipt-page">
        <Card>
          <EmptyState icon={FileX2} title="Comprovante não encontrado" action={<ButtonLink to="/">Voltar para os lotes</ButtonLink>}>
            O link pode estar errado ou ter sido trocado por um novo pelo vencedor.
          </EmptyState>
        </Card>
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div className="page content receipt-page">
        <Card>
          <ErrorState title="Não foi possível abrir o comprovante" message={error?.message} onRetry={load} />
        </Card>
      </div>
    );
  }

  const { lot, signatureValid, chainMatches } = receipt;

  return (
    <div className="page content receipt-page">
      <div className="receipt-actions no-print">
        <p>Este é um comprovante público. Nenhum dado pessoal do vencedor é exibido.</p>
        <Button variant="outline" icon={Printer} onClick={() => window.print()}>
          Imprimir
        </Button>
      </div>

      <Card as="article" className="receipt-document">
        <header>
          <Logo />
          <span>Comprovante de arremate</span>
        </header>

        <div className="receipt-hero">
          {imageFailed ? (
            <div className="receipt-image-fallback">
              <ImageOff size={36} aria-label="Imagem indisponível" />
            </div>
          ) : (
            <img className="artwork-image" src={buildUrl(lot.imageUrl)} alt={lot.title} onError={() => setImageFailed(true)} />
          )}
          <div>
            <span className="eyebrow">Lote encerrado</span>
            <h1>{lot.title}</h1>
            {lot.artist && <p>{lot.artist}</p>}
          </div>
        </div>

        <div className="receipt-facts">
          <div>
            <span>Valor final</span>
            <strong>{formatBRL(receipt.amountCents)}</strong>
          </div>
          <div>
            <span>Vencedor</span>
            <strong>{receipt.winnerAlias ?? '—'}</strong>
          </div>
          <div>
            <span>Data do arremate</span>
            <strong>{formatDateTime(receipt.settledAt)} (Brasília)</strong>
          </div>
        </div>

        {signatureValid ? (
          <div className="signature-seal">
            <ShieldCheck size={30} aria-hidden="true" />
            <div>
              <strong>Assinatura válida</strong>
              <span>Conteúdo conferido com a assinatura criptográfica do leilõesPaintings.</span>
            </div>
            <Badge tone="success">
              <Check size={12} aria-hidden="true" /> verificado
            </Badge>
          </div>
        ) : (
          <div className="signature-seal invalid" role="alert">
            <ShieldAlert size={30} aria-hidden="true" />
            <div>
              <strong>Assinatura inválida</strong>
              <span>O conteúdo deste comprovante não confere com a assinatura. Ele foi alterado depois de emitido.</span>
            </div>
            <Badge tone="danger">
              <AlertCircle size={12} aria-hidden="true" /> não confere
            </Badge>
          </div>
        )}

        {!chainMatches && (
          <div className="receipt-chain-warning">
            <Alert tone="danger">
              <strong>O histórico de lances mudou depois do encerramento.</strong> O último registro da cadeia hoje não é o
              mesmo de quando o lote fechou. Confira na auditoria do lote.
            </Alert>
          </div>
        )}

        <footer>
          <span>Comprovante nº {receipt.number}</span>
          <Link to={`/lotes/${lot.id}/auditoria`} className="receipt-audit-link">
            Ver auditoria do lote
          </Link>
        </footer>
      </Card>
    </div>
  );
}

function ReceiptSkeleton() {
  return (
    <div className="page content receipt-page" aria-busy="true" aria-label="Carregando o comprovante">
      <Card className="receipt-document">
        <div className="receipt-hero">
          <Skeleton className="h-[280px]" />
          <div className="grid gap-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-5 w-1/2" />
          </div>
        </div>
        <Skeleton className="h-24 mx-8 mb-8" />
      </Card>
    </div>
  );
}

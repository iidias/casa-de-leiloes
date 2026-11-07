// Carteira do licitante (tarefa 90). PDF, pág. 3: saldo total, saldo comprometido,
// saldo disponível e opção de depósito simulado.
// Visual do protótipo do Figma Make (docs/design, Wallet.tsx).
import { useCallback, useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Info, WalletCards } from 'lucide-react';
import { api, fieldErrorsFrom } from '../api/client.js';
import { useWallet } from '../context/WalletContext.jsx';
import { formatDateTime } from '../lib/format.js';
import { centsToInput, formatBRL, toCents } from '../lib/money.js';
import Alert from '../components/Alert.jsx';
import Button from '../components/Button.jsx';
import Card from '../components/Card.jsx';
import ErrorState from '../components/ErrorState.jsx';
import Input from '../components/Input.jsx';
import PageTitle from '../components/PageTitle.jsx';
import Skeleton from '../components/Skeleton.jsx';

const QUICK_VALUES = [10_000, 100_000, 1_000_000]; // R$ 100, R$ 1.000, R$ 10.000
const MIN_DEPOSIT = 100; // R$ 1,00 (mesmo limite do backend)
const MAX_DEPOSIT = 10_000_000; // R$ 100.000,00 por depósito

// Entrada (+) ou saída (−) do saldo total, e o texto de cada lançamento do extrato.
const ENTRY_TYPES = {
  DEPOSIT: { sign: 1, label: () => 'Depósito simulado' },
  SETTLEMENT_DEBIT: { sign: -1, label: (lot) => `Arremate de “${lot?.title ?? 'lote'}”` },
  SETTLEMENT_CREDIT: { sign: 1, label: (lot) => `Venda de “${lot?.title ?? 'lote'}”` },
  CANCEL_RELEASE: { sign: 1, label: (lot) => `Estorno de “${lot?.title ?? 'lote'}”` },
};

// O extrato vem do mais recente para o mais antigo. O saldo depois de cada linha
// é calculado de trás para frente a partir do total de agora.
function withRunningBalance(entries, totalCents) {
  let balance = totalCents;
  return entries.map((entry) => {
    const type = ENTRY_TYPES[entry.type] ?? { sign: 1, label: () => entry.type };
    const signed = type.sign * entry.amountCents;
    const row = { ...entry, signed, description: type.label(entry.lot), balanceAfter: balance };
    balance -= signed;
    return row;
  });
}

export default function Wallet() {
  const { applyWallet } = useWallet();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [amount, setAmount] = useState(centsToInput(100_000));
  const [fieldError, setFieldError] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await api.get('/wallet');
      setData(result);
      setError(null);
      applyWallet(result.wallet);
    } catch (err) {
      setError(err);
    }
  }, [applyWallet]);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- os setState só rodam depois da resposta da API
    load();
  }, [load]);

  async function handleDeposit(event) {
    event.preventDefault();
    setFeedback(null);
    const cents = toCents(amount);
    if (cents === null) return setFieldError('Digite um valor em reais, por exemplo 1.000,00');
    if (cents < MIN_DEPOSIT) return setFieldError(`O depósito mínimo é ${formatBRL(MIN_DEPOSIT)}`);
    if (cents > MAX_DEPOSIT) return setFieldError(`O depósito máximo é ${formatBRL(MAX_DEPOSIT)} por vez`);
    setFieldError('');
    setSending(true);
    try {
      const result = await api.post('/wallet/deposits', { amountCents: cents });
      applyWallet(result.wallet);
      setFeedback({ tone: 'success', text: `Depósito de ${formatBRL(cents)} realizado. Saldo atualizado.` });
      await load(); // traz o extrato com a linha nova
    } catch (err) {
      const fields = fieldErrorsFrom(err);
      if (fields.amountCents) setFieldError(fields.amountCents);
      else setFeedback({ tone: 'danger', text: err.message });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="page content">
      <PageTitle eyebrow="Sua conta" title="Carteira">
        Acompanhe o saldo total, os valores comprometidos em disputas e o seu extrato.
      </PageTitle>

      {error && !data ? (
        <Card>
          <ErrorState title="Não foi possível carregar a carteira" message={error.message} onRetry={load} />
        </Card>
      ) : (
        <>
          <div className="balance-grid">
            <Card className="balance-card">
              <span>Saldo total</span>
              {data ? <strong>{formatBRL(data.wallet.totalCents)}</strong> : <Skeleton className="h-9 w-40" />}
              <small>Depositado menos arremates pagos</small>
            </Card>
            <Card className="balance-card">
              <span>Comprometido</span>
              {data ? <strong>{formatBRL(data.wallet.committedCents)}</strong> : <Skeleton className="h-9 w-40" />}
              <small>Em lotes que você está liderando agora</small>
            </Card>
            <Card className="balance-card featured">
              <span>Disponível</span>
              {data ? <strong>{formatBRL(data.wallet.availableCents)}</strong> : <Skeleton className="h-9 w-40" />}
              <small>Livre para novos lances</small>
            </Card>
          </div>
          <Alert tone="info">
            <strong>Como funciona:</strong> ao liderar um lote, o valor do lance fica comprometido. Se outro licitante
            superar seu lance, ele volta na hora para o disponível. Só sai do total quando você arremata.
          </Alert>

          <div className="wallet-layout">
            <Card as="form" className="deposit-panel" onSubmit={handleDeposit} noValidate>
              <div className="panel-heading">
                <span>
                  <WalletCards size={20} aria-hidden="true" />
                </span>
                <div>
                  <h2>Adicionar saldo</h2>
                  <p>Depósito instantâneo para simulação.</p>
                </div>
              </div>
              {feedback && <Alert tone={feedback.tone}>{feedback.text}</Alert>}
              <div className="quick-values">
                {QUICK_VALUES.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setAmount(centsToInput(value));
                      setFieldError('');
                    }}
                  >
                    {formatBRL(value)}
                  </button>
                ))}
              </div>
              <Input
                label="Outro valor"
                prefix="R$"
                inputMode="decimal"
                autoComplete="off"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setFieldError('');
                }}
                hint={`De ${formatBRL(MIN_DEPOSIT)} a ${formatBRL(MAX_DEPOSIT)} por depósito`}
                error={fieldError}
                disabled={sending}
              />
              <Button type="submit" size="lg" loading={sending}>
                {sending ? 'Depositando…' : 'Depositar'}
              </Button>
              <p className="deposit-note">
                <Info size={14} aria-hidden="true" /> Depósito simulado: nenhum valor real é cobrado.
              </p>
            </Card>

            <section className="statement" aria-labelledby="titulo-extrato">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Movimentações</span>
                  <h2 id="titulo-extrato">Extrato</h2>
                </div>
              </div>
              <Statement data={data} />
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function Statement({ data }) {
  if (!data) {
    return (
      <Card className="statement-table p-5 grid gap-3" aria-busy="true">
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
      </Card>
    );
  }
  if (data.entries.length === 0) {
    return (
      <Card className="statement-table">
        <p className="px-5 py-6 text-[14px] text-[var(--color-copy)]">
          Nenhuma movimentação ainda. Faça um depósito para começar a dar lances.
        </p>
      </Card>
    );
  }
  const rows = withRunningBalance(data.entries, data.wallet.totalCents);
  return (
    <Card className="statement-table">
      <div className="statement-head" aria-hidden="true">
        <span>Data</span>
        <span>Descrição</span>
        <span>Valor</span>
        <span>Saldo</span>
      </div>
      {rows.map((row, index) => (
        <div className="statement-row" key={`${row.createdAt}-${index}`}>
          <span className={row.signed >= 0 ? 'entry-icon positive' : 'entry-icon negative'} aria-hidden="true">
            {row.signed >= 0 ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
          </span>
          <time dateTime={row.createdAt}>{formatDateTime(row.createdAt)}</time>
          <strong>{row.description}</strong>
          <span className={row.signed >= 0 ? 'positive-value' : 'negative-value'}>
            {row.signed >= 0 ? '+' : '−'} {formatBRL(Math.abs(row.signed))}
          </span>
          <span>{formatBRL(row.balanceAfter)}</span>
        </div>
      ))}
      {data.entries.length >= 50 && (
        <p className="px-5 py-3 text-[12px] text-[var(--color-muted)] border-t border-[var(--color-line)]">
          Mostrando as 50 movimentações mais recentes.
        </p>
      )}
    </Card>
  );
}

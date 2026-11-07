// Formulário de lance (tarefa 89). Já vem preenchido com o próximo lance mínimo.
// Quem decide é sempre o servidor: o front não bloqueia valor abaixo do mínimo nem
// "já está ganhando"; manda o lance e mostra a mensagem que o backend devolver,
// uma para cada motivo do PDF (abaixo do mínimo, saldo insuficiente, você já está
// ganhando, lote ainda não iniciado, lote encerrado).
import { useImperativeHandle, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { WalletCards } from 'lucide-react';
import { api } from '../../api/client.js';
import { useWallet } from '../../context/WalletContext.jsx';
import { centsToInput, formatBRL, toCents } from '../../lib/money.js';
import Alert from '../Alert.jsx';
import Button from '../Button.jsx';
import Input from '../Input.jsx';

function newIdempotencyKey() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

// React 19: ref chega como prop comum.
export default function BidForm({ lot, onAccepted, onRejected, ref }) {
  const { wallet, applyWallet, refreshWallet } = useWallet();
  const inputRef = useRef(null);
  const [amount, setAmount] = useState(() => centsToInput(lot.minNextBidCents));
  const [dirty, setDirty] = useState(false);
  const [fieldError, setFieldError] = useState('');
  const [feedback, setFeedback] = useState(null); // { tone, content }
  const [sending, setSending] = useState(false);

  // Quando o mínimo muda (lance de outra pessoa), o campo acompanha, a não ser que
  // a pessoa já tenha digitado um valor maior que o novo mínimo.
  const [shownMin, setShownMin] = useState(lot.minNextBidCents);
  if (shownMin !== lot.minNextBidCents) {
    setShownMin(lot.minNextBidCents);
    const typed = toCents(amount);
    if (!dirty || typed === null || typed < lot.minNextBidCents) {
      setAmount(centsToInput(lot.minNextBidCents));
      setDirty(false);
    }
  }

  const fill = (cents) => {
    setAmount(centsToInput(cents));
    setDirty(false);
    setFieldError('');
    inputRef.current?.focus();
  };

  // A sala usa isto no botão "Cobrir com R$ X" e na barra fixa do celular.
  useImperativeHandle(ref, () => ({ fillMinimum: () => fill(lot.minNextBidCents), focus: () => inputRef.current?.focus() }));

  async function handleSubmit(event) {
    event.preventDefault();
    const cents = toCents(amount);
    if (cents === null || cents <= 0) {
      setFieldError('Digite um valor em reais, por exemplo 1.250,00');
      return;
    }
    setFieldError('');
    setFeedback(null);
    setSending(true);
    try {
      // A chave evita lance em dobro se a conexão cair e a pessoa clicar de novo.
      const result = await api.post(`/lots/${lot.id}/bids`, { amountCents: cents }, { headers: { 'Idempotency-Key': newIdempotencyKey() } });
      applyWallet(result.wallet);
      setFeedback({ tone: 'success', content: `Lance de ${formatBRL(result.bid.amountCents)} aceito. Você está liderando.` });
      setDirty(false);
      onAccepted(result);
    } catch (err) {
      let content = err.message;
      if (err.code === 'BELOW_MINIMUM' && err.details?.minNextBidCents) {
        // Já deixa o campo com o mínimo novo.
        setAmount(centsToInput(err.details.minNextBidCents));
        setDirty(false);
      }
      if (err.code === 'INSUFFICIENT_BALANCE') {
        refreshWallet();
        content = (
          <>
            {err.message}. <Link to="/carteira" className="underline font-medium">Ir para a carteira</Link>
          </>
        );
      }
      setFeedback({ tone: 'danger', content });
      onRejected(err);
    } finally {
      setSending(false);
    }
  }

  const isFirstBid = !lot.bidCount;
  const hint = isFirstBid
    ? `Primeiro lance: a partir de ${formatBRL(lot.minNextBidCents)} (lance inicial)`
    : `Lance mínimo: ${formatBRL(lot.minNextBidCents)} (incremento ${formatBRL(lot.minIncrementCents)})`;
  const chips = [
    { label: isFirstBid ? 'Lance inicial' : '+1 incremento', cents: lot.minNextBidCents },
    { label: '+2', cents: lot.minNextBidCents + lot.minIncrementCents },
    { label: '+5', cents: lot.minNextBidCents + 4 * lot.minIncrementCents },
  ];

  return (
    <form className="bid-form" onSubmit={handleSubmit} noValidate id="form-lance">
      {feedback && <Alert tone={feedback.tone}>{feedback.content}</Alert>}
      <Input
        ref={inputRef}
        label="Seu lance"
        prefix="R$"
        inputMode="decimal"
        autoComplete="off"
        value={amount}
        onChange={(e) => {
          setAmount(e.target.value);
          setDirty(true);
          setFieldError('');
        }}
        hint={hint}
        error={fieldError}
        disabled={sending}
      />
      <div className="bid-chips" aria-label="Valores rápidos">
        {chips.map((chip) => (
          <button key={chip.label} type="button" onClick={() => fill(chip.cents)} title={formatBRL(chip.cents)}>
            {chip.label}
          </button>
        ))}
      </div>
      <Button type="submit" size="lg" className="full-button" loading={sending}>
        {sending ? 'Enviando…' : 'Dar lance'}
      </Button>
      <div className="wallet-line">
        <WalletCards size={16} aria-hidden="true" />
        <span>Disponível na carteira</span>
        <strong>{wallet ? formatBRL(wallet.availableCents) : '—'}</strong>
      </div>
    </form>
  );
}

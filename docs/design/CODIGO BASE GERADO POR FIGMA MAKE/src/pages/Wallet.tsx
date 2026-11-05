import { useState } from "react"
import { ArrowDownLeft, ArrowUpRight, Info, WalletCards } from "lucide-react"
import { Alert, Button, Card, Field, PageTitle } from "../components/ui"
import { money } from "../data"
import { useAuction } from "../state/AuctionContext"

const initialEntries = [
  {
    date: "04 nov 2026, 18:24",
    description: "Depósito simulado",
    value: 1000000,
    balance: 1890000,
  },
  {
    date: "02 nov 2026, 20:18",
    description: "Arremate de “American Gothic”",
    value: -480000,
    balance: 890000,
  },
  {
    date: "01 nov 2026, 10:06",
    description: "Depósito simulado",
    value: 870000,
    balance: 1370000,
  },
  {
    date: "30 out 2026, 09:12",
    description: "Depósito simulado",
    value: 500000,
    balance: 500000,
  },
]

export function Wallet() {
  const { total, committed, available, deposit: addDeposit } = useAuction()
  const [amount, setAmount] = useState("1000,00")
  const [entries, setEntries] = useState(initialEntries)
  const [success, setSuccess] = useState(false)

  const deposit = () => {
    const value = Number(amount.replace(/\./g, "").replace(",", ".")) * 100
    if (!Number.isFinite(value) || value <= 0) return
    addDeposit(value)
    setEntries((current) => [
      {
        date: "agora",
        description: "Depósito simulado",
        value,
        balance: total + value,
      },
      ...current,
    ])
    setSuccess(true)
  }

  return (
    <div className="page container">
      <PageTitle eyebrow="Sua conta" title="Carteira">
        Acompanhe o saldo total, valores comprometidos em disputas e seu
        extrato.
      </PageTitle>

      <div className="balance-grid">
        <Card className="balance-card">
          <span>Saldo total</span>
          <strong>{money(total)}</strong>
          <small>Depositado menos arremates pagos</small>
        </Card>
        <Card className="balance-card">
          <span>Comprometido</span>
          <strong>{money(committed)}</strong>
          <small>Em lotes que você está liderando</small>
        </Card>
        <Card className="balance-card featured">
          <span>Disponível</span>
          <strong>{money(available)}</strong>
          <small>Livre para novos lances</small>
        </Card>
      </div>
      <Alert tone="info">
        <strong>Como funciona:</strong> o saldo comprometido é liberado
        imediatamente quando outro licitante supera seu lance.
      </Alert>

      <div className="wallet-layout">
        <Card className="deposit-panel">
          <div className="panel-heading">
            <span>
              <WalletCards size={20} />
            </span>
            <div>
              <h2>Adicionar saldo</h2>
              <p>Depósito instantâneo para simulação.</p>
            </div>
          </div>
          {success && (
            <Alert tone="success">Depósito realizado e saldo atualizado.</Alert>
          )}
          <div className="quick-values">
            {[10000, 100000, 1000000].map((value) => (
              <button
                key={value}
                onClick={() =>
                  setAmount(
                    (value / 100).toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                    }),
                  )
                }
              >
                {money(value)}
              </button>
            ))}
          </div>
          <Field
            label="Outro valor"
            prefix="R$"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
          <Button size="lg" onClick={deposit}>
            Depositar
          </Button>
          <p className="deposit-note">
            <Info size={14} /> Depósito simulado, nenhum valor real é cobrado.
          </p>
        </Card>

        <section className="statement">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Movimentações</span>
              <h2>Extrato</h2>
            </div>
          </div>
          <Card className="statement-table">
            <div className="statement-head">
              <span>Data</span>
              <span>Descrição</span>
              <span>Valor</span>
              <span>Saldo</span>
            </div>
            {entries.map((entry, index) => (
              <div className="statement-row" key={`${entry.date}-${index}`}>
                <span
                  className={
                    entry.value > 0
                      ? "entry-icon positive"
                      : "entry-icon negative"
                  }
                >
                  {entry.value > 0 ? (
                    <ArrowDownLeft size={16} />
                  ) : (
                    <ArrowUpRight size={16} />
                  )}
                </span>
                <time>{entry.date}</time>
                <strong>{entry.description}</strong>
                <span
                  className={
                    entry.value > 0 ? "positive-value" : "negative-value"
                  }
                >
                  {entry.value > 0 ? "+" : "−"} {money(Math.abs(entry.value))}
                </span>
                <span>{money(entry.balance)}</span>
              </div>
            ))}
          </Card>
        </section>
      </div>
    </div>
  )
}

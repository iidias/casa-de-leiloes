import { useMemo, useState } from "react"
import {
  ArrowLeft,
  Check,
  Clock3,
  Gavel,
  LockKeyhole,
  LogIn,
  Plus,
  Radio,
  ShieldCheck,
  WalletCards,
  Wifi,
} from "lucide-react"
import { Link, useParams } from "react-router"
import { bidHistory, lots, money } from "../data"
import {
  Alert,
  ArtworkImage,
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  Field,
  PhaseBadge,
  SelectField,
} from "../components/ui"
import { useAuction } from "../state/AuctionContext"

type PreviewMode = "bidder" | "visitor" | "seller" | "ending" | "reconnecting"
type Refusal = "none" | "minimum" | "balance" | "winning" | "scheduled" | "ended"

const refusals: Record<Exclude<Refusal, "none">, React.ReactNode> = {
  minimum: "O lance mínimo agora é R$ 3.400,00",
  balance: (
    <>
      Saldo disponível insuficiente: R$ 900,00.{" "}
      <Link to="/carteira">Ir para a carteira</Link>
    </>
  ),
  winning: "Você já está ganhando este lote",
  scheduled: "Este lote abre em 05/11 às 19:00",
  ended: "Este lote já foi encerrado",
}

export function LiveLot() {
  const { id } = useParams()
  const lot = lots.find((item) => item.id === id)
  const { available, commitBid } = useAuction()
  const [bid, setBid] = useState("3400,00")
  const [history, setHistory] = useState(bidHistory)
  const [status, setStatus] = useState<"outbid" | "winning">("outbid")
  const [accepted, setAccepted] = useState(false)
  const [mode, setMode] = useState<PreviewMode>("bidder")
  const [refusal, setRefusal] = useState<Refusal>("none")
  const minimum = useMemo(
    () => (status === "outbid" ? 340000 : 360000),
    [status],
  )

  if (!lot) {
    return (
      <div className="page container">
        <Card>
          <EmptyState
            icon={Gavel}
            title="Lote não encontrado"
            action={<ButtonLink to="/">Voltar para os lotes</ButtonLink>}
          >
            Este lote pode ter sido removido ou cancelado.
          </EmptyState>
        </Card>
      </div>
    )
  }

  const isLive = lot.phase === "LIVE"
  const isScheduled = lot.phase === "SCHEDULED"
  const isEnded = lot.phase === "ENDED"
  const isLastMinutes = lot.id === "water-lilies"
  const canBid = isLive && mode === "bidder"

  const placeBid = () => {
    if (!canBid || status === "winning" || mode === "ending") return
    setAccepted(true)
    setRefusal("none")
    setStatus("winning")
    commitBid(340000)
    setHistory([
      {
        alias: "Licitante #2",
        value: 340000,
        time: "agora",
        own: true,
        fresh: true,
      },
      ...history,
    ])
  }

  const updateRefusal = (value: Refusal) => {
    setRefusal(value)
    setAccepted(false)
    if (value === "minimum") setBid("3400,00")
  }

  return (
    <div className="page container live-page">
      <div className="live-toolbar">
        <Link to="/" className="back-link">
          <ArrowLeft size={15} /> Voltar para os lotes
        </Link>
        <SelectField
          label="Pré-visualizar como"
          value={mode}
          onChange={(event) => setMode(event.target.value as PreviewMode)}
        >
          <option value="bidder">Licitante</option>
          <option value="visitor">Visitante</option>
          <option value="seller">Leiloeiro</option>
          <option value="ending">Encerrando</option>
          <option value="reconnecting">Reconectando</option>
        </SelectField>
      </div>

      <div className="live-layout">
        <div className="art-column">
          <Card className="art-frame">
            <ArtworkImage src={lot.image} alt={lot.title} />
          </Card>
          <div className="art-info">
            <span className="eyebrow">Obra em leilão</span>
            <h1>{lot.title}</h1>
            <p className="artist">
              {lot.artist} · {lot.date}
            </p>
            <dl>
              <div>
                <dt>Técnica</dt>
                <dd>{lot.medium}</dd>
              </div>
              <div>
                <dt>Dimensões</dt>
                <dd>{lot.dimensions}</dd>
              </div>
              <div>
                <dt>Acervo</dt>
                <dd>Art Institute of Chicago</dd>
              </div>
            </dl>
            <p className="description">{lot.description}</p>
            <ButtonLink
              to={`/lotes/${lot.id}/auditoria`}
              variant="ghost"
              size="sm"
            >
              <ShieldCheck size={15} /> Auditar este lote
            </ButtonLink>
          </div>
        </div>

        <aside className="auction-column">
          {mode === "reconnecting" && (
            <Alert tone="warning">
              <Wifi size={16} /> Reconectando… Os dados serão atualizados
              automaticamente.
            </Alert>
          )}
          <Card className="auction-panel">
            <div className="auction-heading">
              <PhaseBadge phase={lot.phase} />
              <span>
                <Radio size={14} /> atualizações em tempo real
              </span>
            </div>

            <div className={`current-bid ${isEnded ? "ended-summary" : ""}`}>
              <span>
                {isScheduled
                  ? "Lance inicial"
                  : isEnded
                    ? lot.bids
                      ? "Lote arrematado"
                      : "Resultado"
                    : "Lance atual"}
              </span>
              {isEnded && !lot.bids ? (
                <strong>Encerrado sem lances</strong>
              ) : (
                <strong>
                  {money(isLive && status === "winning" ? 340000 : lot.price)}
                </strong>
              )}
              <small>
                {isScheduled
                  ? "A disputa ainda não começou"
                  : isEnded && lot.bids
                    ? "Arrematado por Licitante #2"
                    : isEnded
                      ? "Nenhum vencedor"
                      : `por ${
                          status === "winning" ? "Licitante #2" : "Licitante #3"
                        }`}
              </small>
            </div>

            {!isEnded && (
              <div
                className={`countdown-panel ${
                  isLastMinutes && isLive ? "critical" : "normal"
                }`}
              >
                <div>
                  <span>{isScheduled ? "Abre em" : "Encerra em"}</span>
                  <strong>
                    {mode === "ending"
                      ? "Encerrando…"
                      : isScheduled
                        ? "02:14:09"
                        : lot.id === "bedroom"
                          ? "08:24"
                          : lot.id === "wave"
                            ? "21:06"
                            : "01:38"}
                  </strong>
                </div>
                {isLastMinutes && isLive && mode !== "ending" && (
                  <>
                    <Badge tone="danger">
                      <Plus size={12} /> 2:00
                    </Badge>
                    <p>
                      <Clock3 size={15} /> Cada lance agora acrescenta 2 minutos
                      ao contador.
                    </p>
                  </>
                )}
              </div>
            )}

            {canBid &&
              (status === "winning" ? (
                <div className="bid-status winning">
                  <Check size={20} />
                  <div>
                    <strong>Você está ganhando</strong>
                    <span>Você está em 1º de 3 licitantes</span>
                  </div>
                </div>
              ) : (
                <div className="bid-status outbid">
                  <Gavel size={20} />
                  <div>
                    <strong>Você foi superado</strong>
                    <span>Você está em 2º de 3 licitantes</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBid("3400,00")}
                  >
                    Cobrir com {money(minimum)}
                  </Button>
                </div>
              ))}

            {isScheduled ? (
              <div className="bid-form">
                <Alert tone="info">Este lote abre em 05/11 às 19:00.</Alert>
                <Field
                  label="Seu lance"
                  prefix="R$"
                  value={money(lot.price).replace("R$", "").trim()}
                  disabled
                />
                <Button size="lg" className="full-button" disabled>
                  Aguardar abertura
                </Button>
              </div>
            ) : isEnded ? null : mode === "visitor" ? (
              <div className="access-panel">
                <LogIn size={22} />
                <div>
                  <strong>Entre para dar lances</strong>
                  <span>Você pode acompanhar a disputa sem uma conta.</span>
                </div>
                <Button>Entrar</Button>
              </div>
            ) : mode === "seller" ? (
              <div className="bid-form">
                <Alert tone="info">
                  <LockKeyhole size={16} /> Leiloeiros não podem dar lances.
                </Alert>
              </div>
            ) : (
              <div className="bid-form">
                {accepted && (
                  <Alert tone="success">
                    Lance de {money(340000)} aceito. Você está liderando.
                  </Alert>
                )}
                <Field
                  label="Seu lance"
                  prefix="R$"
                  value={bid}
                  onChange={(event) => setBid(event.target.value)}
                  hint={`Lance mínimo: ${money(minimum)} (incremento ${money(20000)})`}
                />
                <SelectField
                  label="Simular recusa"
                  value={refusal}
                  onChange={(event) =>
                    updateRefusal(event.target.value as Refusal)
                  }
                >
                  <option value="none">Nenhuma</option>
                  <option value="minimum">Abaixo do mínimo</option>
                  <option value="balance">Saldo insuficiente</option>
                  <option value="winning">Já está ganhando</option>
                  <option value="scheduled">Lote ainda não iniciado</option>
                  <option value="ended">Lote encerrado</option>
                </SelectField>
                {refusal !== "none" && (
                  <Alert tone="danger">{refusals[refusal]}</Alert>
                )}
                <div className="bid-chips">
                  <button onClick={() => setBid("3400,00")}>
                    +1 incremento
                  </button>
                  <button onClick={() => setBid("3600,00")}>+2</button>
                  <button onClick={() => setBid("4200,00")}>+5</button>
                </div>
                <Button
                  size="lg"
                  className="full-button"
                  onClick={placeBid}
                  disabled={status === "winning" || mode === "ending"}
                >
                  {mode === "ending"
                    ? "Encerrando…"
                    : status === "winning"
                      ? "Você já está ganhando"
                      : "Dar lance"}
                </Button>
                <div className="wallet-line">
                  <WalletCards size={16} />
                  <span>Disponível na carteira</span>
                  <strong>{money(available)}</strong>
                </div>
              </div>
            )}
          </Card>
        </aside>
      </div>

      <section className="history-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Transparência</span>
            <h2>Histórico de lances</h2>
          </div>
          <span>Mais recente primeiro · horário de Brasília</span>
        </div>
        <Card className="bid-history">
          {history.map((item, index) => (
            <div
              key={`${item.alias}-${item.time}-${index}`}
              className={item.fresh ? "fresh" : ""}
            >
              <span className="bid-index">{history.length - index}</span>
              <div>
                <strong>{item.alias}</strong>
                {item.own && <Badge tone="info">você</Badge>}
              </div>
              <strong>{money(item.value)}</strong>
              <time>{item.time}</time>
            </div>
          ))}
        </Card>
      </section>

      {isLive && mode !== "visitor" && mode !== "seller" && (
        <div className="mobile-bid-bar">
          <div>
            <span>Lance atual</span>
            <strong>{money(status === "winning" ? 340000 : lot.price)}</strong>
          </div>
          <div>
            <span>Encerra em</span>
            <strong>
              {mode === "ending"
                ? "Encerrando…"
                : lot.meta.replace("termina em ", "")}
            </strong>
          </div>
          <Button
            onClick={placeBid}
            disabled={status === "winning" || mode === "ending"}
          >
            {status === "winning"
              ? "Ganhando"
              : mode === "ending"
                ? "Encerrando"
                : "Dar lance"}
          </Button>
        </div>
      )}
    </div>
  )
}

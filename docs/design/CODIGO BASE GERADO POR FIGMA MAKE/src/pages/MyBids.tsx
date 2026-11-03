import { useState } from "react"
import {
  Check,
  Clock3,
  Copy,
  ExternalLink,
  Link2,
  RefreshCw,
  Trophy,
} from "lucide-react"
import { lots, money } from "../data"
import {
  Alert,
  ArtworkImage,
  Badge,
  Button,
  ButtonLink,
  Card,
  PageTitle,
  PhaseBadge,
} from "../components/ui"

export function MyBids() {
  const [copied, setCopied] = useState(false)
  const live = lots.slice(0, 2)
  const won = lots.find((lot) => lot.id === "american-gothic")!
  const shareUrl = `${window.location.origin}/c/receipt-a8c21f`

  const copy = async () => {
    await navigator.clipboard?.writeText(shareUrl)
    setCopied(true)
  }

  return (
    <div className="page container">
      <PageTitle eyebrow="Sua atividade" title="Meus lances e arremates">
        Acompanhe disputas em andamento e compartilhe comprovantes dos lotes que
        venceu.
      </PageTitle>

      <section className="my-bids-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Em andamento</span>
            <h2>Disputas ativas</h2>
          </div>
          <span>2 lotes</span>
        </div>
        <div className="activity-list">
          {live.map((lot, index) => (
            <Card className="activity-card" key={lot.id}>
              <ArtworkImage src={lot.image} alt={lot.title} />
              <div className="activity-main">
                <PhaseBadge phase="LIVE" />
                <h3>{lot.title}</h3>
                <p>{lot.artist}</p>
              </div>
              <div className="activity-stat">
                <span>Meu maior lance</span>
                <strong>{money(index ? 640000 : 300000)}</strong>
              </div>
              <div className="activity-stat">
                <span>
                  <Clock3 size={13} /> Tempo restante
                </span>
                <strong>{index ? "08:24" : "01:38"}</strong>
              </div>
              <Badge tone={index ? "success" : "danger"}>
                {index ? "Ganhando" : "Superado"}
              </Badge>
              <ButtonLink to={`/lotes/${lot.id}`} variant="outline" size="sm">
                Abrir sala
              </ButtonLink>
            </Card>
          ))}
        </div>
      </section>

      <section className="my-bids-section won-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Concluídos</span>
            <h2>Arrematados</h2>
          </div>
          <span>1 comprovante</span>
        </div>
        <Card className="won-card">
          <div className="won-art">
            <ArtworkImage src={won.image} alt={won.title} />
            <span>
              <Trophy size={22} />
            </span>
          </div>
          <div className="won-info">
            <Badge tone="success">
              <Check size={12} /> Arrematado
            </Badge>
            <h3>{won.title}</h3>
            <p>
              {won.artist}, {won.date}
            </p>
            <div>
              <span>Valor final</span>
              <strong>{money(won.price)}</strong>
            </div>
          </div>
          <div className="share-panel">
            <label>
              <span>
                <Link2 size={14} /> Link público do comprovante
              </span>
              <div>
                <input readOnly value={shareUrl} />
                <Button variant="secondary" size="sm" onClick={copy}>
                  {copied ? <Check size={15} /> : <Copy size={15} />}{" "}
                  {copied ? "Copiado" : "Copiar"}
                </Button>
              </div>
            </label>
            {copied && (
              <Alert tone="success">
                Link copiado. Ele não revela seu nome nem e-mail.
              </Alert>
            )}
            <div className="share-actions">
              <ButtonLink to="/c/receipt-a8c21f" size="sm">
                Ver comprovante <ExternalLink size={14} />
              </ButtonLink>
              <Button variant="ghost" size="sm">
                <RefreshCw size={14} /> Gerar novo link
              </Button>
            </div>
          </div>
        </Card>
      </section>
    </div>
  )
}

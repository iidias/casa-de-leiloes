import { useMemo, useState } from "react"
import { AlertCircle, ArrowRight, Gavel } from "lucide-react"
import { lots, money, type Phase } from "../data"
import {
  ArtworkImage,
  ButtonLink,
  Card,
  EmptyState,
  PageTitle,
  PhaseBadge,
  SelectField,
  Button,
} from "../components/ui"

const tabs: { phase: Phase label: string }[] = [
  { phase: "LIVE", label: "Ao vivo" },
  { phase: "SCHEDULED", label: "Agendados" },
  { phase: "ENDED", label: "Encerrados" },
]

export function Gallery() {
  const [phase, setPhase] = useState<Phase>("LIVE")
  const [preview, setPreview] = useState<"content" | "loading" | "error">(
    "content",
  )
  const visible = useMemo(
    () => lots.filter((lot) => lot.phase === phase),
    [phase],
  )

  return (
    <div className="page container">
      <PageTitle title="Lotes">
        Obras selecionadas para disputas transparentes, ao vivo e auditáveis.
      </PageTitle>
      <div className="prototype-controls">
        <SelectField
          label="Pré-visualizar estado"
          value={preview}
          onChange={(event) => setPreview(event.target.value as typeof preview)}
        >
          <option value="content">Conteúdo</option>
          <option value="loading">Carregando</option>
          <option value="error">Erro</option>
        </SelectField>
      </div>
      <div className="tabs" role="tablist" aria-label="Fases dos lotes">
        {tabs.map((tab) => (
          <button
            key={tab.phase}
            className={phase === tab.phase ? "active" : ""}
            onClick={() => setPhase(tab.phase)}
            role="tab"
            aria-selected={phase === tab.phase}
          >
            {tab.label}{" "}
            <span>{lots.filter((lot) => lot.phase === tab.phase).length}</span>
          </button>
        ))}
      </div>

      {preview === "loading" ? (
        <div className="lot-grid" aria-label="Carregando lotes">
          {[1, 2, 3, 4].map((item) => (
            <Card key={item} className="lot-card skeleton-card">
              <div className="skeleton skeleton-image" />
              <div className="lot-body">
                <div className="skeleton skeleton-title" />
                <div className="skeleton skeleton-copy" />
              </div>
              <div className="lot-footer">
                <div className="skeleton skeleton-value" />
              </div>
            </Card>
          ))}
        </div>
      ) : preview === "error" ? (
        <Card>
          <EmptyState
            icon={AlertCircle}
            title="Não foi possível carregar os lotes"
            action={
              <Button onClick={() => setPreview("content")}>
                Tentar de novo
              </Button>
            }
          >
            Verifique sua conexão e tente novamente em alguns instantes.
          </EmptyState>
        </Card>
      ) : visible.length ? (
        <div className="lot-grid">
          {visible.map((lot) => (
            <Card key={lot.id} className="lot-card">
              <div className="lot-image">
                <ArtworkImage src={lot.image} alt={lot.title} />
                <PhaseBadge phase={lot.phase} />
              </div>
              <div className="lot-body">
                <h2>{lot.title}</h2>
                <p>
                  {lot.artist}, {lot.date}
                </p>
                <span>
                  {lot.bids ? `${lot.bids} lances` : "Nenhum lance ainda"}
                </span>
              </div>
              <div className="lot-footer">
                <div>
                  <span>
                    {lot.phase === "LIVE"
                      ? "Lance atual"
                      : lot.phase === "SCHEDULED"
                        ? "Lance inicial"
                        : lot.bids
                          ? "Valor final"
                          : "Resultado"}
                  </span>
                  <strong>
                    {lot.phase === "ENDED" && !lot.bids
                      ? "Sem lances"
                      : money(lot.price)}
                  </strong>
                  <small>{lot.meta}</small>
                </div>
                <ButtonLink
                  to={`/lotes/${lot.id}`}
                  variant={lot.phase === "ENDED" ? "outline" : "primary"}
                  size="sm"
                >
                  {lot.phase === "LIVE" ? "Entrar na sala" : "Ver lote"}{" "}
                  <ArrowRight size={14} />
                </ButtonLink>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState icon={Gavel} title="Nenhum lote nesta fase">
            Novos lotes aparecerão aqui assim que forem publicados.
          </EmptyState>
        </Card>
      )}
    </div>
  )
}

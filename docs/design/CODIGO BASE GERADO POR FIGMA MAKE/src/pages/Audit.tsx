import { useState } from "react"
import { AlertCircle, ArrowLeft, Check, Hash, ShieldCheck } from "lucide-react"
import { Link, useParams } from "react-router"
import { lots, money } from "../data"
import {
  Alert,
  ArtworkImage,
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  IntegritySeal,
  PhaseBadge,
  SelectField,
} from "../components/ui"

const hashes = ["3f9a…c21e", "81bc…0f29", "c221…9aa4", "f01d…bd83", "a924…72c0"]

export function Audit() {
  const { id } = useParams()
  const lot = lots.find((item) => item.id === id)
  const [valid, setValid] = useState(true)

  if (!lot) {
    return (
      <div className="page container">
        <Card>
          <EmptyState icon={ShieldCheck} title="Auditoria indisponível">
            O lote solicitado não foi encontrado.
          </EmptyState>
        </Card>
      </div>
    )
  }

  return (
    <div className="page container audit-page">
      <Link to={`/lotes/${lot.id}`} className="back-link">
        <ArrowLeft size={15} /> Voltar para a sala
      </Link>
      <div className="prototype-controls">
        <SelectField
          label="Estado da auditoria"
          value={valid ? "valid" : "tampered"}
          onChange={(event) => setValid(event.target.value === "valid")}
        >
          <option value="valid">Íntegro</option>
          <option value="tampered">Adulterado</option>
        </SelectField>
      </div>
      <Card className="audit-lot">
        <ArtworkImage src={lot.image} alt={lot.title} />
        <div>
          <span className="eyebrow">Auditoria pública</span>
          <h1>{lot.title}</h1>
          <p>
            {lot.artist}, {lot.date}
          </p>
        </div>
        <PhaseBadge phase={lot.phase} />
      </Card>

      <div className="audit-summary">
        <IntegritySeal valid={valid} count={5} />
        <Alert tone={valid ? "success" : "danger"}>
          <strong>
            {valid
              ? "Verificado também no seu navegador."
              : "Falhou no seu navegador."}
          </strong>{" "}
          {valid
            ? "A cadeia SHA-256 foi recalculada localmente e coincide com o histórico publicado."
            : "A cadeia recalculada não coincide com os registros publicados."}
        </Alert>
      </div>

      {!valid && (
        <Alert tone="danger">
          <div>
            <strong>Problemas encontrados</strong>
            <ul className="audit-problems">
              <li>Lance #4: hash não confere</li>
              <li>Sequência pula do #5 para o #7</li>
            </ul>
          </div>
        </Alert>
      )}

      <Card className="verification-note">
        {valid ? <ShieldCheck size={24} /> : <AlertCircle size={24} />}
        <div>
          <h3>Verificação em duas camadas</h3>
          <p>
            Seu navegador confere a sequência e os hashes de cada lance. O
            servidor valida o selo secreto HMAC, que não fica armazenado no
            banco de dados.
          </p>
        </div>
        <Badge tone={valid ? "success" : "danger"}>
          {valid ? <Check size={12} /> : <AlertCircle size={12} />}{" "}
          {valid ? "2 de 2 válidas" : "verificação falhou"}
        </Badge>
      </Card>

      <section className="audit-history">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Cadeia de integridade</span>
            <h2>Histórico completo</h2>
          </div>
          <span>
            {valid ? "5 registros verificados" : "2 problemas encontrados"}
          </span>
        </div>
        <Card className="audit-table">
          <div className="audit-row audit-head">
            <span>Seq.</span>
            <span>Licitante</span>
            <span>Valor</span>
            <span>Horário</span>
            <span>Hash SHA-256</span>
          </div>
          {hashes.map((hash, index) => {
            const sequence = 5 - index
            const affected = !valid && (sequence === 4 || sequence === 2)
            const aliases = [3, 2, 1, 3, 2]
            return (
              <div
                className={`audit-row ${affected ? "tampered" : ""}`}
                key={hash}
              >
                <span>
                  {affected && <AlertCircle size={13} />} #{sequence}
                </span>
                <strong>Licitante #{aliases[index]}</strong>
                <strong>{money(320000 - index * 20000)}</strong>
                <time>
                  19:{42 - index * 2}:{18 - index}
                </time>
                <code>
                  <Hash size={13} /> {hash}
                </code>
              </div>
            )
          })}
        </Card>
      </section>
    </div>
  )
}

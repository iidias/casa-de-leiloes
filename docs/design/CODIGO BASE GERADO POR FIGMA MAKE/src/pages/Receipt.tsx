import { Check, FileX2, Printer, ShieldCheck } from "lucide-react"
import { useParams } from "react-router"
import { lots, money } from "../data"
import {
  ArtworkImage,
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  Logo,
} from "../components/ui"

export function Receipt() {
  const { token } = useParams()
  const lot = lots.find((item) => item.id === "american-gothic")!

  if (token !== "receipt-a8c21f") {
    return (
      <div className="page container receipt-page">
        <Card>
          <EmptyState
            icon={FileX2}
            title="Comprovante não encontrado"
            action={<ButtonLink to="/">Voltar para os lotes</ButtonLink>}
          >
            O link pode ser inválido, ter expirado ou ter sido revogado.
          </EmptyState>
        </Card>
      </div>
    )
  }
  return (
    <div className="page container receipt-page">
      <div className="receipt-actions no-print">
        <p>
          Este é um comprovante público. Nenhum dado pessoal do vencedor é
          exibido.
        </p>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer size={16} /> Imprimir
        </Button>
      </div>
      <Card className="receipt-document">
        <header>
          <Logo />
          <span>Comprovante de arremate</span>
        </header>
        <div className="receipt-hero">
          <ArtworkImage src={lot.image} alt={lot.title} />
          <div>
            <span className="eyebrow">Lote encerrado</span>
            <h1>{lot.title}</h1>
            <p>
              {lot.artist}, {lot.date}
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
            </dl>
          </div>
        </div>
        <div className="receipt-facts">
          <div>
            <span>Valor final</span>
            <strong>{money(lot.price)}</strong>
          </div>
          <div>
            <span>Vencedor</span>
            <strong>Licitante #2</strong>
          </div>
          <div>
            <span>Data do arremate</span>
            <strong>02 nov 2026 · 20:18 BRT</strong>
          </div>
        </div>
        <div className="signature-seal">
          <ShieldCheck size={30} />
          <div>
            <strong>Assinatura válida</strong>
            <span>
              Conteúdo conferido com assinatura criptográfica do
              leilõesPaintings.
            </span>
          </div>
          <Badge tone="success">
            <Check size={12} /> verificado
          </Badge>
        </div>
        <footer>
          <span>Comprovante público · emissão 02/11/2026</span>
          <span>Assinatura conferida</span>
        </footer>
      </Card>
    </div>
  )
}

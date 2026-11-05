import { createBrowserRouter } from "react-router"
import { Layout } from "../components/Layout"
import { EmptyState, ButtonLink } from "../components/ui"
import { SearchX } from "lucide-react"
import { Gallery } from "../pages/Gallery"
import { LiveLot } from "../pages/LiveLot"
import { Wallet } from "../pages/Wallet"
import { Audit } from "../pages/Audit"
import { MyBids } from "../pages/MyBids"
import { Receipt } from "../pages/Receipt"
import "../pages/gallery-live.css"
import "../pages/account.css"

function NotFound() {
  return (
    <div className="page container">
      <section className="card">
        <EmptyState
          icon={SearchX}
          title="Página não encontrada"
          action={<ButtonLink to="/">Voltar para os lotes</ButtonLink>}
        >
          O endereço informado não existe ou não está mais disponível.
        </EmptyState>
      </section>
    </div>
  )
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Gallery },
      { path: "lotes/:id", Component: LiveLot },
      { path: "lotes/:id/auditoria", Component: Audit },
      { path: "carteira", Component: Wallet },
      { path: "meus-lances", Component: MyBids },
      { path: "c/:token", Component: Receipt },
      { path: "*", Component: NotFound },
    ],
  },
])

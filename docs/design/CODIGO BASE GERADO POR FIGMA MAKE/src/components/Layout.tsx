import { useState } from "react"
import { Menu, WalletCards, X } from "lucide-react"
import { NavLink, Outlet } from "react-router"
import { Button, Logo } from "./ui"
import { AuctionProvider, useAuction } from "../state/AuctionContext"
import { money } from "../data"

const links = [
  { to: "/", label: "Lotes" },
  { to: "/carteira", label: "Carteira" },
  { to: "/meus-lances", label: "Meus lances" },
]

function AppLayout() {
  const [open, setOpen] = useState(false)
  const { available } = useAuction()

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="header-inner">
          <Logo />
          <nav
            className={open ? "nav-open" : ""}
            aria-label="Navegação principal"
          >
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === "/"}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
          <div className="account">
            <div className="available">
              <WalletCards size={16} />
              <span>Disponível</span>
              <strong>{money(available)}</strong>
            </div>
            <span className="avatar">MA</span>
            <div className="account-name">
              <strong>Marina Alves</strong>
              <span>Licitante</span>
            </div>
            <Button variant="ghost" size="sm">
              Sair
            </Button>
          </div>
          <button
            className="menu-button"
            onClick={() => setOpen(!open)}
            aria-label="Abrir menu"
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="site-footer">
        <Logo />
        <p>Leilões transparentes de obras em domínio público.</p>
        <span>Horário de Brasília · Valores em reais</span>
      </footer>
    </div>
  )
}

export function Layout() {
  return (
    <AuctionProvider>
      <AppLayout />
    </AuctionProvider>
  )
}

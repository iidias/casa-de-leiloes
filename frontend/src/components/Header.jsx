// Header global: marca, navegação por papel, quem está logado e "Sair".
// Estrutura do header do projeto anterior com o visual do protótipo.
// No celular a navegação vira um menu recolhido.
// Para o licitante, mostra o saldo disponível (PDF: volta ao disponível assim que é superado).
import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { LogIn, LogOut, Menu, WalletCards, X } from 'lucide-react';
import { useWallet } from '../context/WalletContext.jsx';
import { formatBRL } from '../lib/money.js';
import { useAuth } from '../context/AuthContext.jsx';
import { ROLE_LABELS, homePathForRole } from '../lib/format.js';
import Button from './Button.jsx';
import Logo from './Logo.jsx';

const NAV_BY_ROLE = {
  BIDDER: [
    { to: '/', label: 'Lotes', end: true },
    { to: '/carteira', label: 'Carteira' },
    { to: '/meus-lances', label: 'Meus lances' },
  ],
  SELLER: [
    { to: '/', label: 'Lotes', end: true },
    { to: '/leiloeiro', label: 'Meu painel', end: true },
    { to: '/leiloeiro/novo', label: 'Novo lote' },
  ],
};
const VISITOR_NAV = [{ to: '/', label: 'Lotes', end: true }];

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts.at(-1)[0] : '')).toUpperCase() || '?';
}

export default function Header() {
  const { user, isAuthenticated, logout } = useAuth();
  const { wallet, isBidder } = useWallet();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const navItems = (isAuthenticated && NAV_BY_ROLE[user.role]) || VISITOR_NAV;

  const handleLogout = () => {
    setMenuOpen(false);
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="site-header">
      <div className="header-inner">
        <Logo to={isAuthenticated ? homePathForRole(user.role) : '/'} />

        <nav className={menuOpen ? 'nav-open' : ''} aria-label="Navegação principal">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setMenuOpen(false)}>
              {item.label}
            </NavLink>
          ))}
          {/* No celular, "Sair" fica dentro do menu para o header caber em telas estreitas. */}
          {isAuthenticated && (
            <button type="button" className="nav-logout" onClick={handleLogout}>
              <LogOut size={16} aria-hidden="true" /> Sair
            </button>
          )}
        </nav>

        <div className="account">
          {isAuthenticated ? (
            <>
              {isBidder && (
                <Link to="/carteira" className="available" title="Saldo disponível para lances">
                  <WalletCards size={16} aria-hidden="true" />
                  <span>Disponível</span>
                  <strong className="money">{wallet ? formatBRL(wallet.availableCents) : '—'}</strong>
                </Link>
              )}
              <span className="avatar" aria-hidden="true">
                {initials(user.name)}
              </span>
              <div className="account-name">
                <strong>{user.name}</strong>
                <span>{ROLE_LABELS[user.role] ?? user.role}</span>
              </div>
              <Button variant="ghost" size="sm" icon={LogOut} onClick={handleLogout} aria-label="Sair" className="account-logout">
                <span className="hidden lg:inline">Sair</span>
              </Button>
            </>
          ) : (
            <Button size="sm" icon={LogIn} onClick={() => navigate('/login')} aria-label="Entrar">
              <span className="hidden sm:inline">Entrar</span>
            </Button>
          )}
        </div>

        <button
          type="button"
          className="menu-button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X /> : <Menu />}
        </button>
      </div>
    </header>
  );
}

// Layout global: header fixo, conteúdo da rota e rodapé.
import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useWallet } from '../context/WalletContext.jsx';
import Header from './Header.jsx';
import Logo from './Logo.jsx';

export default function Layout() {
  const { pathname } = useLocation();
  const { refreshWallet } = useWallet();
  // Saldo do header recarregado a cada troca de tela: pode ter mudado em outra sala.
  useEffect(() => {
    refreshWallet();
  }, [pathname, refreshWallet]);

  return (
    <div className="app-shell">
      <Header />
      <main>
        <Outlet />
      </main>
      <footer className="site-footer">
        <Logo />
        <p>Leilões transparentes de obras em domínio público.</p>
        <span>Horário de Brasília · Valores em reais</span>
      </footer>
    </div>
  );
}

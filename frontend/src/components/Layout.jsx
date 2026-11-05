// Layout global: header fixo, conteúdo da rota e rodapé.
import { Outlet } from 'react-router-dom';
import Header from './Header.jsx';
import Logo from './Logo.jsx';

export default function Layout() {
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

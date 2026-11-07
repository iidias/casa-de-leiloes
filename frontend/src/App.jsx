import { Routes, Route } from 'react-router-dom';
import { Hammer } from 'lucide-react';

import Layout from './components/Layout.jsx';
import ProtectedRoute from './routes/ProtectedRoute.jsx';
import Card from './components/Card.jsx';
import EmptyState from './components/EmptyState.jsx';
import Login from './pages/Login.jsx';
import Lots from './pages/Lots.jsx';
import LotRoom from './pages/LotRoom.jsx';
import Wallet from './pages/Wallet.jsx';
import MyBids from './pages/MyBids.jsx';
import Register from './pages/Register.jsx';
import NotFound from './pages/NotFound.jsx';

// Provisório: cada rota ganha a tela de verdade nas tarefas 92 a 95,
// e este marcador sai quando a última tela entrar.
function EmConstrucao({ tela }) {
  return (
    <div className="page container">
      <Card>
        <EmptyState icon={Hammer} title={tela}>
          Esta tela ainda está sendo construída.
        </EmptyState>
      </Card>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Login e cadastro têm tela cheia própria, sem o header. */}
      <Route path="/login" element={<Login />} />
      <Route path="/cadastro" element={<Register />} />

      <Route element={<Layout />}>
        {/* Públicas: a API também não pede login para vitrine, sala, auditoria e comprovante. */}
        <Route path="/" element={<Lots />} />
        <Route path="/lotes/:id" element={<LotRoom />} />
        <Route path="/lotes/:id/auditoria" element={<EmConstrucao tela="Auditoria do lote" />} />
        <Route path="/c/:token" element={<EmConstrucao tela="Comprovante" />} />

        {/* Licitante */}
        <Route element={<ProtectedRoute roles={['BIDDER']} />}>
          <Route path="/carteira" element={<Wallet />} />
          <Route path="/meus-lances" element={<MyBids />} />
        </Route>

        {/* Leiloeiro */}
        <Route element={<ProtectedRoute roles={['SELLER']} />}>
          <Route path="/leiloeiro" element={<EmConstrucao tela="Painel do leiloeiro" />} />
          <Route path="/leiloeiro/novo" element={<EmConstrucao tela="Novo lote" />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

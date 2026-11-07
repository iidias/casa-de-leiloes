import { Routes, Route } from 'react-router-dom';

import Layout from './components/Layout.jsx';
import ProtectedRoute from './routes/ProtectedRoute.jsx';
import Login from './pages/Login.jsx';
import Lots from './pages/Lots.jsx';
import LotRoom from './pages/LotRoom.jsx';
import Wallet from './pages/Wallet.jsx';
import MyBids from './pages/MyBids.jsx';
import Register from './pages/Register.jsx';
import Audit from './pages/Audit.jsx';
import Receipt from './pages/Receipt.jsx';
import NotFound from './pages/NotFound.jsx';
import SellerDashboard from './pages/SellerDashboard.jsx';
import NewLot from './pages/NewLot.jsx';

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
        <Route path="/lotes/:id/auditoria" element={<Audit />} />
        <Route path="/c/:token" element={<Receipt />} />

        {/* Licitante */}
        <Route element={<ProtectedRoute roles={['BIDDER']} />}>
          <Route path="/carteira" element={<Wallet />} />
          <Route path="/meus-lances" element={<MyBids />} />
        </Route>

        {/* Leiloeiro */}
        <Route element={<ProtectedRoute roles={['SELLER']} />}>
          <Route path="/leiloeiro" element={<SellerDashboard />} />
          <Route path="/leiloeiro/novo" element={<NewLot />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

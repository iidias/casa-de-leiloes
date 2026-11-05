// ProtectedRoute, reaproveitado do meu projeto anterior. É experiência, não segurança:
// quem decide de verdade é o backend (requireAuth/requireRole). Qualquer pessoa
// mexe no navegador, então esconder uma tela aqui não protege dado nenhum.

import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { homePathForRole } from '../lib/format.js';

/**
 * @param {object} props
 * @param {string[]} [props.roles]  papéis permitidos; sem isso basta estar logado
 */
export default function ProtectedRoute({ roles, children }) {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    // Guarda de onde veio para o login voltar para lá depois.
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (roles?.length && !roles.includes(user?.role)) {
    return <Navigate to={homePathForRole(user?.role)} replace />;
  }

  return children ?? <Outlet />;
}

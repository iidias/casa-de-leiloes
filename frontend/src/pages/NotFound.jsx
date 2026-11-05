// Página 404 (o acabamento final é da tarefa 96).
import { SearchX } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { homePathForRole } from '../lib/format.js';
import Card from '../components/Card.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { ButtonLink } from '../components/Button.jsx';

export default function NotFound() {
  const { user, isAuthenticated } = useAuth();
  const home = isAuthenticated ? homePathForRole(user.role) : '/';

  return (
    <div className="page content">
      <Card>
        <EmptyState
          icon={SearchX}
          title="Página não encontrada"
          action={<ButtonLink to={home}>Voltar para o início</ButtonLink>}
        >
          O endereço informado não existe ou não está mais disponível.
        </EmptyState>
      </Card>
    </div>
  );
}

// ErrorState: falha ao carregar, com "tentar novamente".
import { AlertCircle } from 'lucide-react';
import Button from './Button.jsx';

export default function ErrorState({
  title = 'Algo deu errado',
  message = 'Verifique sua conexão e tente novamente.',
  onRetry,
  retryLabel = 'Tentar novamente',
}) {
  return (
    <div className="empty-state error" role="alert">
      <span>
        <AlertCircle size={28} aria-hidden="true" />
      </span>
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}

// EmptyState: ausência de conteúdo, com ação opcional.
import { Inbox } from 'lucide-react';

export default function EmptyState({ icon: Icon = Inbox, title = 'Nada por aqui', children, action }) {
  return (
    <div className="empty-state">
      <span>
        <Icon size={28} aria-hidden="true" />
      </span>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

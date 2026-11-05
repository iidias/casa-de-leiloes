// Alert inline: recusa de lance, sucesso de depósito, aviso de reconexão...
import { AlertCircle, Check, Info, TriangleAlert } from 'lucide-react';

const ICONS = { success: Check, danger: AlertCircle, warning: TriangleAlert, info: Info };

export default function Alert({ tone = 'info', action, children }) {
  const Icon = ICONS[tone] ?? Info;
  return (
    <div className={`alert alert-${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <Icon size={18} aria-hidden="true" />
      <div>{children}</div>
      {action}
    </div>
  );
}

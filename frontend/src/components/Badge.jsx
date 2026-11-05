// Badge: informações curtas e status. PhaseBadge traduz a fase do lote.
import { PHASE_LABELS } from '../lib/format.js';

export default function Badge({ tone = 'neutral', className = '', children }) {
  return <span className={`badge badge-${tone} ${className}`}>{children}</span>;
}

const PHASE_TONES = { LIVE: 'live', SCHEDULED: 'scheduled', ENDED: 'ended', CANCELLED: 'danger' };

export function PhaseBadge({ phase }) {
  return (
    <span className={`badge badge-${PHASE_TONES[phase] ?? 'neutral'}`}>
      {phase === 'LIVE' && <i aria-hidden="true" />}
      {PHASE_LABELS[phase] ?? phase}
    </span>
  );
}

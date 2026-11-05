// Datas e rótulos. O backend manda datas em ISO (UTC); a tela mostra no
// horário de Brasília, que é o que o leilão anuncia.

const TIME_ZONE = 'America/Sao_Paulo';

export function formatDateTime(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('pt-BR', {
    timeZone: TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTime(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString('pt-BR', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

// 93784000 ms → "1d 02:03:04"; abaixo de um dia → "02:03:04"; abaixo de uma hora → "03:04".
export function formatDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  if (days > 0) return `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  if (hours > 0) return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(minutes)}:${pad(seconds)}`;
}

// Para onde cada papel vai depois de entrar (ou se cair numa tela que não é dele).
export function homePathForRole(role) {
  return role === 'SELLER' ? '/leiloeiro' : '/';
}

export const ROLE_LABELS = {
  BIDDER: 'Licitante',
  SELLER: 'Leiloeiro',
};

export const PHASE_LABELS = {
  LIVE: 'Ao vivo',
  SCHEDULED: 'Agendado',
  ENDED: 'Encerrado',
  CANCELLED: 'Cancelado',
};

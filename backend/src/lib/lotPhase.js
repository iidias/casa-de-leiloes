// Fase do lote calculada pelo horário (D6). Uma função só, usada pela vitrine,
// pela sala, pelo lance e pelo encerrador (tarefa 44).
// No EXATO endsAt o lote já está encerrado: comparação com <, não com <=.

export const PHASES = Object.freeze(['SCHEDULED', 'LIVE', 'ENDED']);

export function lotPhase(lot, now) {
  if (lot.status === 'CANCELLED') return 'CANCELLED';
  if (lot.status === 'SETTLED') return 'ENDED';
  if (now < lot.startsAt) return 'SCHEDULED';
  if (now < lot.endsAt) return 'LIVE';
  return 'ENDED'; // já passou do fim, liquidação pendente
}

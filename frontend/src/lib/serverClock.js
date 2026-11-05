// Relógio do servidor no navegador.
// O relógio do computador de quem assiste pode estar adiantado ou atrasado.
// Toda resposta de lote traz serverNow (tarefa 77); guardamos a diferença
// (offset = serverNow − Date.now()) e a contagem regressiva usa serverNow() em vez
// de Date.now(). Quem decide se o lance chegou a tempo continua sendo o servidor.

let offsetMs = 0;
const listeners = new Set();

export function syncServerClock(serverNowIso) {
  const serverMs = Date.parse(serverNowIso);
  if (Number.isNaN(serverMs)) return;
  const next = serverMs - Date.now();
  // Ignora oscilações pequenas de rede para a contagem não "pular" à toa.
  if (Math.abs(next - offsetMs) < 250) return;
  offsetMs = next;
  listeners.forEach((listener) => listener(offsetMs));
}

export function serverNow() {
  return Date.now() + offsetMs;
}

export function getServerOffset() {
  return offsetMs;
}

export function onServerClockChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

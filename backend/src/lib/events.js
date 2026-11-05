// Tempo real da sala do lote (tarefa 75): Server-Sent Events.
// Um Map<lotId, Set<res>> em memória. Público e SEM dado pessoal: só apelidos.
// Limitação (README): o Map é por instância; com várias instâncias seria preciso
// Postgres LISTEN/NOTIFY ou Redis. Uma instância basta para o desafio.

const channels = new Map();
const MAX_CONNECTIONS = 2000; // teto global, para conexões abertas não esgotarem o servidor
const MAX_PER_IP = 20; // teto por endereço: um só cliente não ocupa as vagas de todo mundo
const perIp = new Map();
let total = 0;

export function canSubscribe(ip) {
  return total < MAX_CONNECTIONS && (perIp.get(ip) ?? 0) < MAX_PER_IP;
}

export function subscribe(lotId, res, ip) {
  if (!channels.has(lotId)) channels.set(lotId, new Set());
  channels.get(lotId).add(res);
  total += 1;
  perIp.set(ip, (perIp.get(ip) ?? 0) + 1);
  return () => {
    const set = channels.get(lotId);
    if (set?.delete(res)) {
      total -= 1;
      const left = (perIp.get(ip) ?? 1) - 1;
      if (left > 0) perIp.set(ip, left);
      else perIp.delete(ip);
    }
    if (set && set.size === 0) channels.delete(lotId);
  };
}

export function send(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify({ ...data, serverNow: new Date() })}\n\n`);
}

// Chamado SEMPRE depois do commit da transação: se ela falhasse, a sala mostraria algo que não existe.
export function publish(lotId, event, data) {
  const set = channels.get(lotId);
  if (!set) return;
  for (const res of set) send(res, event, data);
}

export const subscriberCount = (lotId) => channels.get(lotId)?.size ?? 0;
export const totalSubscribers = () => total;

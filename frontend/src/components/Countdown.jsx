// Countdown: tempo até uma data, pelo relógio do servidor (lib/serverClock.js).
// Fica vermelho abaixo de urgentBelowMs (2 min = janela da prorrogação) e
// chama onEnd uma vez quando zera. O texto que aparece no zero é endedLabel.
import { useEffect, useRef } from 'react';
import useServerNow from '../hooks/useServerNow.js';
import { formatDuration } from '../lib/format.js';

export default function Countdown({
  to,
  urgentBelowMs = 2 * 60 * 1000,
  onEnd,
  endedLabel = 'Encerrado',
  className = '',
}) {
  const now = useServerNow();
  const target = Date.parse(to);
  const remaining = Number.isNaN(target) ? 0 : target - now;
  const ended = remaining <= 0;

  const onEndRef = useRef(onEnd);
  useEffect(() => {
    onEndRef.current = onEnd;
  });

  // Só avisa na virada (estava contando e zerou). Um lote que já abre encerrado
  // não dispara onEnd, para quem usa não recarregar em loop.
  const wasRunning = useRef(false);
  useEffect(() => {
    if (!ended) {
      wasRunning.current = true;
    } else if (wasRunning.current) {
      wasRunning.current = false;
      onEndRef.current?.();
    }
  }, [ended]);

  const urgent = !ended && remaining < urgentBelowMs;
  return (
    <time
      dateTime={to}
      className={`countdown ${urgent ? 'urgent' : ''} ${className}`}
      aria-label={ended ? endedLabel : `Faltam ${formatDuration(remaining)}`}
    >
      {ended ? endedLabel : formatDuration(remaining)}
    </time>
  );
}

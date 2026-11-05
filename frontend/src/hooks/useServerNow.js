// Hora do servidor que se atualiza sozinha (para contagens regressivas).
// Um único relógio por componente; para quando a aba some e volta certo depois.

import { useEffect, useState } from 'react';
import { onServerClockChange, serverNow } from '../lib/serverClock.js';

export default function useServerNow(intervalMs = 1000) {
  const [now, setNow] = useState(serverNow);

  useEffect(() => {
    const tick = () => setNow(serverNow());
    const id = setInterval(tick, intervalMs);
    const stop = onServerClockChange(tick);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      stop();
      document.removeEventListener('visibilitychange', tick);
    };
  }, [intervalMs]);

  return now;
}

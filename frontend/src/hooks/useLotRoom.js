// Estado da sala do lote, sempre atualizado sem recarregar a página (PDF, pág. 3).
// - GET /lots/:id traz o lote e o histórico; GET /lots/:id/me traz a posição do licitante.
// - Server-Sent Events (/lots/:id/stream) avisam: bid, extended, settled e cancelled.
// - Ao conectar e a cada reconexão chega "ready": aí o lote é buscado de novo, porque
//   o SSE não reenvia o que se perdeu enquanto a conexão estava caída.
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, buildUrl } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useWallet } from '../context/WalletContext.jsx';
import { serverNow, syncServerClock } from '../lib/serverClock.js';

const RECONNECT_MS = 5000;

export default function useLotRoom(lotId) {
  const { user, isAuthenticated } = useAuth();
  const { refreshWallet } = useWallet();
  const isBidder = isAuthenticated && user?.role === 'BIDDER';

  const [lot, setLot] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | notfound | error | cancelled
  const [loadError, setLoadError] = useState(null);
  const [me, setMe] = useState(null);
  const [connection, setConnection] = useState('connecting'); // connecting | open | reconnecting
  const [freshSeqs, setFreshSeqs] = useState(() => new Set());
  const [extendedAt, setExtendedAt] = useState(0);

  const meRef = useRef(null);
  useEffect(() => {
    meRef.current = me;
  }, [me]);
  const alive = useRef(true);
  const lotRequest = useRef(0);

  const loadLot = useCallback(async () => {
    const id = ++lotRequest.current;
    try {
      const data = await api.get(`/lots/${lotId}`, { auth: false });
      if (!alive.current || id !== lotRequest.current) return true;
      setLot(data.lot);
      setStatus('ready');
      setLoadError(null);
      return true;
    } catch (err) {
      if (!alive.current || id !== lotRequest.current) return true;
      if (err.status === 404) {
        setStatus((current) => (current === 'cancelled' ? current : 'notfound'));
        return false;
      }
      setLoadError(err);
      setStatus((current) => (current === 'ready' ? current : 'error'));
      return true;
    }
  }, [lotId]);

  const loadMe = useCallback(async () => {
    if (!isBidder) return;
    try {
      const data = await api.get(`/lots/${lotId}/me`);
      if (alive.current) setMe(data);
    } catch {
      // A posição é complemento; se falhar, a sala continua funcionando.
    }
  }, [lotId, isBidder]);

  const refreshAll = useCallback(() => {
    loadLot();
    loadMe();
    if (meRef.current?.alias) refreshWallet();
  }, [loadLot, loadMe, refreshWallet]);

  // Lance aceito (pela resposta do POST ou pelo SSE). Um evento atrasado nunca faz o preço voltar.
  const applyBid = useCallback((bid, lotFields) => {
    setLot((previous) => {
      if (!previous) return previous;
      const known = previous.bids.some((b) => b.seq === bid.seq);
      const newest = previous.bids[0]?.seq ?? 0;
      const bids = known
        ? previous.bids
        : [{ seq: bid.seq, alias: bid.alias, amountCents: bid.amountCents, createdAt: bid.createdAt }, ...previous.bids].sort(
            (a, b) => b.seq - a.seq,
          );
      if (bid.seq < newest) return { ...previous, bids };
      return {
        ...previous,
        bids,
        currentPriceCents: lotFields.currentPriceCents,
        minNextBidCents: lotFields.minNextBidCents,
        bidCount: lotFields.bidCount,
        endsAt: lotFields.endsAt,
        leaderAlias: lotFields.leaderAlias ?? previous.leaderAlias,
      };
    });
    setFreshSeqs((previous) => new Set(previous).add(bid.seq));
  }, []);

  // A página monta um componente novo para cada lote (key), então o estado começa limpo.
  useEffect(() => {
    alive.current = true;
    // oxlint-disable-next-line react/set-state-in-effect -- os setState só rodam depois da resposta da API
    loadLot();
    loadMe();
    return () => {
      alive.current = false;
    };
  }, [loadLot, loadMe]);

  // Tempo real.
  useEffect(() => {
    let source = null;
    let retryTimer = null;
    const control = { stopped: false };

    const connect = () => {
      source = new EventSource(buildUrl(`/lots/${lotId}/stream`));
      const read = (event) => {
        const data = JSON.parse(event.data);
        if (data.serverNow) syncServerClock(data.serverNow);
        return data;
      };
      source.addEventListener('ready', (event) => {
        read(event);
        setConnection('open');
        refreshAll();
      });
      source.addEventListener('bid', (event) => {
        const data = read(event);
        applyBid(data, data);
        loadMe();
        // Quem foi superado tem o valor de volta no disponível na hora (PDF).
        if (meRef.current?.alias) refreshWallet();
      });
      source.addEventListener('extended', (event) => {
        const data = read(event);
        setLot((previous) => (previous ? { ...previous, endsAt: data.endsAt } : previous));
        setExtendedAt(serverNow());
      });
      source.addEventListener('settled', (event) => {
        read(event);
        refreshAll();
      });
      source.addEventListener('cancelled', () => {
        setStatus('cancelled');
        control.stopped = true;
        source.close();
      });
      source.onerror = () => {
        if (control.stopped) return;
        setConnection('reconnecting');
        // Fechada de vez (ex.: 503 por excesso de salas, 404): confere o lote e tenta de novo.
        if (source.readyState === EventSource.CLOSED) {
          retryTimer = setTimeout(async () => {
            if (control.stopped) return;
            const exists = await loadLot();
            if (exists && !control.stopped) connect();
          }, RECONNECT_MS);
        }
      };
    };

    connect();
    return () => {
      control.stopped = true;
      clearTimeout(retryTimer);
      source?.close();
    };
  }, [lotId, applyBid, loadLot, loadMe, refreshAll, refreshWallet]);

  return { lot, status, loadError, me, connection, freshSeqs, extendedAt, isBidder, loadLot, loadMe, applyBid, refreshAll };
}

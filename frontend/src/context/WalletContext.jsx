// Saldo do licitante compartilhado entre o header, a sala e a carteira.
// PDF: quando o licitante é superado, o valor "volta ao disponível imediatamente".
// Por isso o saldo é recarregado sempre que algo pode tê-lo mudado: ao trocar de tela,
// ao voltar para a aba e quando a sala recebe um lance novo.
// Só existe para licitante; para leiloeiro e visitante fica nulo.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from './AuthContext.jsx';

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const isBidder = isAuthenticated && user?.role === 'BIDDER';
  // { owner, totalCents, committedCents, availableCents }: owner evita mostrar o saldo de outra conta.
  const [wallet, setWallet] = useState(null);
  const userId = user?.id;
  const request = useRef(0);

  const refreshWallet = useCallback(async () => {
    if (!isBidder) return null;
    const id = ++request.current;
    try {
      const data = await api.get('/wallet');
      // Só a resposta mais recente vale: duas recargas seguidas não trocam o valor novo pelo velho.
      if (id === request.current) setWallet({ ...data.wallet, owner: userId });
      return data;
    } catch {
      return null; // o saldo no header é informativo; a tela da carteira mostra o erro
    }
  }, [isBidder, userId]);

  // Atualização vinda de uma resposta que já traz o saldo (lance aceito, depósito).
  const applyWallet = useCallback((next) => {
    request.current += 1;
    if (next) setWallet({ ...next, owner: userId });
  }, [userId]);

  useEffect(() => {
    if (!isBidder) {
      request.current += 1; // descarta resposta que ainda esteja a caminho
      return undefined;
    }
    // oxlint-disable-next-line react/set-state-in-effect -- o saldo só muda depois da resposta da API
    refreshWallet();
    const onVisible = () => {
      if (!document.hidden) refreshWallet();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [isBidder, refreshWallet]);

  // Fora do papel de licitante, ou com o saldo de outra conta ainda guardado, não mostra nada.
  const visibleWallet = isBidder && wallet?.owner === userId ? wallet : null;
  const value = useMemo(
    () => ({ wallet: visibleWallet, isBidder, refreshWallet, applyWallet }),
    [visibleWallet, isBidder, refreshWallet, applyWallet],
  );
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) throw new Error('useWallet precisa estar dentro de <WalletProvider>');
  return context;
}

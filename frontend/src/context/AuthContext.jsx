// AuthContext, reaproveitado do meu projeto anterior: guarda token e usuário,
// persiste no localStorage e expõe login()/logout() para a árvore toda.
// Novo aqui: se a API responder 401 para um token salvo, a sessão é encerrada.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { SESSION_EXPIRED_EVENT, TOKEN_STORAGE_KEY } from '../api/client.js';

const USER_STORAGE_KEY = 'auth.user';

const AuthContext = createContext(null);

// Lê a autenticação salva uma vez só. Se algo estiver corrompido, começa deslogado.
function readPersistedAuth() {
  try {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    const rawUser = localStorage.getItem(USER_STORAGE_KEY);
    if (!token || !rawUser) return { token: null, user: null };
    return { token, user: JSON.parse(rawUser) };
  } catch {
    return { token: null, user: null };
  }
}

function clearPersistedAuth() {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
  } catch {
    // sem localStorage não há nada para limpar
  }
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(readPersistedAuth);
  const [sessionExpired, setSessionExpired] = useState(false);

  const login = useCallback((token, user) => {
    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    } catch {
      // Sem localStorage (modo privado, por exemplo) a sessão vale só para esta aba.
    }
    setSessionExpired(false);
    setAuth({ token, user });
  }, []);

  const logout = useCallback(() => {
    clearPersistedAuth();
    setAuth({ token: null, user: null });
  }, []);

  useEffect(() => {
    const onExpired = () => {
      clearPersistedAuth();
      setAuth({ token: null, user: null });
      setSessionExpired(true);
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  const value = useMemo(
    () => ({
      token: auth.token,
      user: auth.user,
      isAuthenticated: Boolean(auth.token && auth.user),
      sessionExpired,
      login,
      logout,
    }),
    [auth, sessionExpired, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return context;
}

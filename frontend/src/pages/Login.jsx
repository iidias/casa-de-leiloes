// Tela de login, reaproveitada do meu projeto anterior.
// Chama POST /auth/login, guarda a sessão no AuthContext e leva cada papel para a
// sua tela inicial (licitante → vitrine, leiloeiro → painel), ou de volta para a
// tela que pediu login.
import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { ROLE_LABELS, homePathForRole } from '../lib/format.js';
import Alert from '../components/Alert.jsx';
import AuthCard from '../components/AuthCard.jsx';
import Badge from '../components/Badge.jsx';
import Button from '../components/Button.jsx';
import Input from '../components/Input.jsx';
import PasswordInput from '../components/PasswordInput.jsx';

// Contas criadas pelo seed (backend/prisma/seed.js), para quem avalia entrar com um clique.
const TEST_ACCOUNTS = [
  { label: 'Leiloeiro', role: 'SELLER', email: 'leiloeiro@teste.com' },
  { label: 'Licitante 1', role: 'BIDDER', email: 'licitante1@teste.com' },
  { label: 'Licitante 2', role: 'BIDDER', email: 'licitante2@teste.com' },
];
const TEST_PASSWORD = 'senha123';

export default function Login() {
  const { login, isAuthenticated, user, sessionExpired } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (isAuthenticated) {
    return <Navigate to={homePathForRole(user.role)} replace />;
  }

  async function authenticate(credentials, { shortcut = false } = {}) {
    setLoading(true);
    setError('');
    try {
      const { token, user: loggedUser } = await api.post('/auth/login', credentials, { auth: false });
      login(token, loggedUser);
      const from = location.state?.from;
      const back = from ? `${from.pathname}${from.search ?? ''}` : null;
      navigate(back ?? homePathForRole(loggedUser.role), { replace: true });
    } catch (err) {
      setError(
        shortcut && err.status === 401
          ? 'Conta de teste não encontrada. Rode o seed do backend (npm run seed) e tente de novo.'
          : err.message,
      );
      setLoading(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    setTouched(true);
    if (!email.trim() || !password) return;
    authenticate({ email: email.trim(), password });
  }

  function handleShortcut(account) {
    setEmail(account.email);
    setPassword(TEST_PASSWORD);
    setTouched(false);
    authenticate({ email: account.email, password: TEST_PASSWORD }, { shortcut: true });
  }

  return (
    <AuthCard subtitle="Entre para dar lances ou gerenciar seus lotes">
      {sessionExpired && <Alert tone="warning">Sua sessão expirou. Entre de novo para continuar.</Alert>}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <Input
          label="E-mail"
          type="email"
          autoComplete="email"
          placeholder="seu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={touched && !email.trim() ? 'Informe o e-mail' : undefined}
          disabled={loading}
        />
        <PasswordInput
          label="Senha"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={touched && !password ? 'Informe a senha' : undefined}
          disabled={loading}
        />

        {error && <Alert tone="danger">{error}</Alert>}

        <Button type="submit" size="lg" className="w-full mt-1" loading={loading}>
          {loading ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>

      <p className="text-[13px] text-[var(--color-copy)] text-center">
        Não tem conta?{' '}
        <Link to="/cadastro" className="text-[var(--color-brand)] font-medium hover:underline">
          Criar conta
        </Link>
      </p>

      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="flex-1 h-px bg-[var(--color-line)]" />
        <span className="text-[12px] text-[var(--color-muted)]">contas de teste</span>
        <span className="flex-1 h-px bg-[var(--color-line)]" />
      </div>

      <div className="flex flex-col gap-2">
        {TEST_ACCOUNTS.map((account) => (
          <button
            key={account.email}
            type="button"
            disabled={loading}
            onClick={() => handleShortcut(account)}
            className="flex items-center justify-between w-full px-3 py-2 rounded-[4px] border border-[var(--color-line)] bg-white hover:bg-[var(--color-canvas)] text-left cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="flex flex-col gap-0.5">
              <span className="text-[13px] font-medium">Entrar como {account.label}</span>
              <span className="font-mono text-[11px] text-[var(--color-muted)]">{account.email}</span>
            </span>
            <Badge tone={account.role === 'SELLER' ? 'dark' : 'info'}>{ROLE_LABELS[account.role]}</Badge>
          </button>
        ))}
        <p className="text-[12px] text-[var(--color-muted)] text-center">
          Senha das contas de teste: <span className="font-mono">{TEST_PASSWORD}</span>
        </p>
      </div>
    </AuthCard>
  );
}

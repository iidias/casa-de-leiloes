// Tela de cadastro, reaproveitada do meu projeto anterior.
// POST /auth/register já devolve token e usuário, então a sessão começa aqui mesmo.
// O papel é decidido pelo backend a partir de isSeller ("Sou leiloeiro"); o front
// não manda "role". As regras da senha seguem as do backend (8 caracteres, até 72 bytes).
import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api, fieldErrorsFrom } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { homePathForRole } from '../lib/format.js';
import Alert from '../components/Alert.jsx';
import AuthCard from '../components/AuthCard.jsx';
import Button from '../components/Button.jsx';
import Input from '../components/Input.jsx';
import PasswordInput from '../components/PasswordInput.jsx';

const utf8Bytes = (text) => new TextEncoder().encode(text).length;

export default function Register() {
  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSeller, setIsSeller] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Ao mexer num campo, o erro dele some; os outros continuam até o próximo envio.
  const onField = (field, setter) => (event) => {
    setter(event.target.value);
    setFieldErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));
  };

  if (isAuthenticated) {
    return <Navigate to={homePathForRole(user.role)} replace />;
  }

  function validate() {
    const errors = {};
    if (name.trim().length < 2) errors.name = 'Informe seu nome';
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) errors.email = 'Informe um e-mail válido';
    if (password.length < 8) errors.password = 'A senha precisa ter pelo menos 8 caracteres';
    else if (utf8Bytes(password) > 72) errors.password = 'A senha está longa demais';
    if (confirmPassword !== password) errors.confirmPassword = 'As senhas não conferem';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    if (!validate()) return;

    setLoading(true);
    try {
      const { token, user: createdUser } = await api.post(
        '/auth/register',
        { name: name.trim(), email: email.trim(), password, isSeller },
        { auth: false },
      );
      login(token, createdUser);
      navigate(homePathForRole(createdUser.role), { replace: true });
    } catch (err) {
      // Erro de campo vai para o campo; o resto (e-mail já usado, muitas tentativas) fica no aviso.
      const fromServer = fieldErrorsFrom(err);
      if (Object.keys(fromServer).length > 0) setFieldErrors(fromServer);
      else setError(err.message);
      setLoading(false);
    }
  }

  return (
    <AuthCard subtitle="Crie sua conta para participar dos leilões">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <Input
          label="Nome"
          autoComplete="name"
          placeholder="Seu nome"
          maxLength={80}
          value={name}
          onChange={onField('name', setName)}
          error={fieldErrors.name}
          disabled={loading}
        />
        <Input
          label="E-mail"
          type="email"
          autoComplete="email"
          placeholder="seu@email.com"
          value={email}
          onChange={onField('email', setEmail)}
          error={fieldErrors.email}
          disabled={loading}
        />
        <PasswordInput
          label="Senha"
          autoComplete="new-password"
          placeholder="Mínimo de 8 caracteres"
          value={password}
          onChange={onField('password', setPassword)}
          error={fieldErrors.password}
          disabled={loading}
        />
        <PasswordInput
          label="Confirmar senha"
          autoComplete="new-password"
          placeholder="Repita a senha"
          value={confirmPassword}
          onChange={onField('confirmPassword', setConfirmPassword)}
          error={fieldErrors.confirmPassword}
          disabled={loading}
        />

        <label className="flex items-start gap-3 p-3 rounded-[4px] border border-[var(--color-line)] cursor-pointer has-[:checked]:border-[var(--color-brand)]">
          <input
            type="checkbox"
            className="mt-1 accent-[var(--color-brand)]"
            checked={isSeller}
            onChange={(e) => setIsSeller(e.target.checked)}
            disabled={loading}
          />
          <span className="flex flex-col gap-0.5">
            <span className="text-[14px] font-medium">Sou leiloeiro</span>
            <span className="text-[12px] text-[var(--color-copy)]">
              {isSeller
                ? 'Sua conta vai cadastrar lotes e acompanhar os resultados. Leiloeiros não dão lances.'
                : 'Sua conta vai dar lances. Você começa com a carteira zerada e deposita quando quiser.'}
            </span>
          </span>
        </label>

        {error && <Alert tone="danger">{error}</Alert>}

        <Button type="submit" size="lg" className="w-full mt-1" loading={loading}>
          {loading ? 'Criando conta…' : 'Criar conta'}
        </Button>
      </form>

      <p className="text-[13px] text-[var(--color-copy)] text-center">
        Já tem conta?{' '}
        <Link to="/login" className="text-[var(--color-brand)] font-medium hover:underline">
          Entrar
        </Link>
      </p>
    </AuthCard>
  );
}

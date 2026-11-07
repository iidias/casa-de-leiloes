// Criar lote em 2 passos (tarefa 95). PDF, pág. 2: o leiloeiro busca o item na API pública,
// escolhe um e define lance inicial (valor mínimo), incremento mínimo, horário de início e de fim.
// Fluxo reaproveitado do NewEvent.jsx do meu projeto anterior (ingressos): passo 1 busca no
// catálogo, passo 2 formulário. Título, imagem e atributos vêm da API e ficam só para leitura;
// o backend busca a obra de novo pelo id, então o front não consegue trocar a imagem nem o título.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, ImageOff, Search, SearchX } from 'lucide-react';
import { api, fieldErrorsFrom } from '../api/client.js';
import { formatDateTime } from '../lib/format.js';
import { formatBRL, toCents } from '../lib/money.js';
import { serverNow } from '../lib/serverClock.js';
import Alert from '../components/Alert.jsx';
import Button, { ButtonLink } from '../components/Button.jsx';
import Card from '../components/Card.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ErrorState from '../components/ErrorState.jsx';
import Input from '../components/Input.jsx';
import PageTitle from '../components/PageTitle.jsx';
import Skeleton from '../components/Skeleton.jsx';

const STEPS = ['Buscar obra', 'Configurar lote'];
const MIN_CENTS = 100; // R$ 1,00 (mesmo limite do backend)
const MAX_CENTS = 100_000_000; // R$ 1 milhão
const MIN_DURATION_MS = 2 * 60 * 1000;
const MAX_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const DESCRIPTION_MAX = 2000;

// O campo datetime-local não tem fuso. O leilão anuncia horário de Brasília (sem horário de verão
// desde 2019), então o valor digitado vira "...-03:00", qualquer que seja o fuso do computador.
const toBrasiliaIso = (local) => (local ? `${local}:00-03:00` : null);
// Agora em Brasília, no formato do datetime-local (para o mínimo do campo).
function brasiliaLocalNow() {
  const shifted = new Date(serverNow() - 3 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 16);
}

function StepIndicator({ current }) {
  return (
    <ol className="steps" aria-label="Etapas">
      {STEPS.map((label, i) => (
        <li key={label} className={i < current ? 'done' : i === current ? 'current' : ''} aria-current={i === current ? 'step' : undefined}>
          <span>{i < current ? <Check size={13} aria-hidden="true" /> : i + 1}</span>
          {label}
        </li>
      ))}
    </ol>
  );
}

export default function NewLot() {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState(null);
  const [created, setCreated] = useState(null);

  if (created) {
    return (
      <div className="page content">
        <Card className="new-lot-done">
          <EmptyState
            icon={Check}
            title="Lote criado"
            action={
              <div className="flex flex-wrap justify-center gap-3">
                <ButtonLink to={`/lotes/${created.id}`}>{created.phase === 'LIVE' ? 'Abrir a sala' : 'Ver o lote'}</ButtonLink>
                <ButtonLink to="/leiloeiro" variant="outline">
                  Voltar ao painel
                </ButtonLink>
              </div>
            }
          >
            {created.title}{' '}
            {created.phase === 'LIVE'
              ? 'já está ao vivo e recebendo lances.'
              : `abre para lances em ${formatDateTime(created.startsAt)} (horário de Brasília).`}
          </EmptyState>
        </Card>
      </div>
    );
  }

  return (
    <div className="page content new-lot">
      <Link to="/leiloeiro" className="back-link">
        <ArrowLeft size={15} aria-hidden="true" /> Voltar ao painel
      </Link>
      <PageTitle eyebrow="Novo lote" title="Criar lote">
        Escolha uma obra em domínio público do Art Institute of Chicago e defina as regras do leilão.
      </PageTitle>
      <StepIndicator current={step} />

      {/* A busca continua montada no passo 2: "Trocar obra" volta para os mesmos resultados. */}
      <div hidden={step !== 0}>
        <CatalogSearch
          onSelect={(item) => {
            setSelected(item);
            setStep(1);
            window.scrollTo({ top: 0 });
          }}
        />
      </div>
      {step === 1 && <LotForm item={selected} onBack={() => setStep(0)} onCreated={setCreated} />}
    </div>
  );
}

// ---------- Passo 1: busca no catálogo ----------

function CatalogSearch({ onSelect }) {
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | results | empty | error
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const [fieldError, setFieldError] = useState('');

  async function search(event) {
    event?.preventDefault();
    const term = query.trim();
    if (term.length < 2) {
      setFieldError('Digite pelo menos 2 caracteres');
      return;
    }
    setFieldError('');
    setStatus('loading');
    setSearched(term);
    try {
      const data = await api.get(`/catalog/search?q=${encodeURIComponent(term)}`);
      setResults(data.items);
      setStatus(data.items.length === 0 ? 'empty' : 'results');
    } catch (err) {
      const fields = fieldErrorsFrom(err);
      if (fields.q) {
        setFieldError(fields.q);
        setStatus('idle');
        return;
      }
      setError(err);
      setStatus('error');
    }
  }

  return (
    <>
      <Card as="form" className="catalog-search" onSubmit={search} noValidate role="search">
        <Input
          label="Buscar no catálogo"
          placeholder="Ex.: Monet, Van Gogh, paisagem…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          error={fieldError}
          hint="Só aparecem obras em domínio público e com imagem."
          maxLength={80}
          autoFocus
        />
        <Button type="submit" variant="secondary" icon={Search} loading={status === 'loading'}>
          Buscar
        </Button>
      </Card>

      {status === 'loading' && (
        <div className="catalog-grid" aria-busy="true" aria-label="Buscando obras">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="grid gap-2">
              <Skeleton className="h-52" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      )}
      {status === 'results' && (
        <>
          <p className="catalog-count">
            {results.length} {results.length === 1 ? 'obra encontrada' : 'obras encontradas'} para “{searched}”. Escolha uma para continuar.
          </p>
          <div className="catalog-grid">
            {results.map((item) => (
              <CatalogCard key={item.externalId} item={item} onSelect={() => onSelect(item)} />
            ))}
          </div>
        </>
      )}
      {status === 'empty' && (
        <Card>
          <EmptyState icon={SearchX} title="Nenhuma obra encontrada">
            Nada em domínio público com imagem para “{searched}”. Tente outro termo, como o nome do artista.
          </EmptyState>
        </Card>
      )}
      {status === 'error' && (
        <Card>
          {error?.status === 502 ? (
            <ErrorState
              title="Catálogo indisponível"
              message="O catálogo do Art Institute of Chicago não respondeu agora. Os lotes que já existem continuam funcionando; tente buscar de novo em instantes."
              onRetry={search}
              retryLabel="Buscar de novo"
            />
          ) : (
            <ErrorState title="Não foi possível buscar" message={error?.message} onRetry={search} retryLabel="Buscar de novo" />
          )}
        </Card>
      )}
    </>
  );
}

function CatalogCard({ item, onSelect }) {
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <button type="button" className="catalog-card card" onClick={onSelect}>
      {imageFailed ? (
        <span className="catalog-noimage">
          <ImageOff size={28} aria-label="Imagem indisponível" />
        </span>
      ) : (
        <img className="artwork-image" src={item.imageUrl} alt="" loading="lazy" onError={() => setImageFailed(true)} />
      )}
      <span className="catalog-info">
        <strong>{item.title}</strong>
        <small>{[item.artist, item.dateDisplay].filter(Boolean).join(' · ') || 'Artista desconhecido'}</small>
        <em>Escolher esta obra</em>
      </span>
    </button>
  );
}

// ---------- Passo 2: formulário ----------

function LotForm({ item, onBack, onCreated }) {
  const [startingPrice, setStartingPrice] = useState('');
  const [increment, setIncrement] = useState('');
  const [startMode, setStartMode] = useState('now'); // now | schedule
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  // Mesmas regras do backend (validators/lotSchemas.js), para o erro aparecer antes de enviar.
  function validate() {
    const next = {};
    const startCents = toCents(startingPrice);
    const incrementCents = toCents(increment);
    if (startCents === null) next.startingPriceCents = 'Informe o lance inicial, ex.: 1.500,00';
    else if (startCents < MIN_CENTS) next.startingPriceCents = 'O lance inicial precisa ser de pelo menos R$ 1,00';
    else if (startCents > MAX_CENTS) next.startingPriceCents = 'O lance inicial pode ser de no máximo R$ 1.000.000,00';
    if (incrementCents === null) next.minIncrementCents = 'Informe o incremento mínimo, ex.: 100,00';
    else if (incrementCents < MIN_CENTS) next.minIncrementCents = 'O incremento precisa ser de pelo menos R$ 1,00';
    else if (incrementCents > MAX_CENTS) next.minIncrementCents = 'O incremento pode ser de no máximo R$ 1.000.000,00';

    const now = serverNow();
    const start = startMode === 'now' ? now : Date.parse(toBrasiliaIso(startsAt));
    const end = Date.parse(toBrasiliaIso(endsAt));
    if (startMode === 'schedule') {
      if (!startsAt || Number.isNaN(start)) next.startsAt = 'Informe a data e a hora de início';
      else if (start < now - 60 * 1000) next.startsAt = 'O início não pode estar no passado';
    }
    if (!endsAt || Number.isNaN(end)) next.endsAt = 'Informe a data e a hora de fim';
    else if (!next.startsAt) {
      const duration = end - start;
      if (duration <= 0) next.endsAt = 'O fim precisa ser depois do início';
      else if (duration < MIN_DURATION_MS) next.endsAt = 'O lote precisa durar pelo menos 2 minutos';
      else if (duration > MAX_DURATION_MS) next.endsAt = 'O lote pode durar no máximo 30 dias';
    }
    if (description.length > DESCRIPTION_MAX) next.description = 'A descrição pode ter no máximo 2.000 caracteres';
    setErrors(next);
    return next;
  }

  async function submit(event) {
    event.preventDefault();
    setApiError(null);
    const found = validate();
    if (Object.keys(found).length > 0) {
      document.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }
    setSaving(true);
    try {
      const body = {
        externalId: item.externalId,
        startingPriceCents: toCents(startingPrice),
        minIncrementCents: toCents(increment),
        startsAt: startMode === 'now' ? new Date(serverNow()).toISOString() : toBrasiliaIso(startsAt),
        endsAt: toBrasiliaIso(endsAt),
      };
      if (description.trim()) body.description = description.trim();
      const result = await api.post('/seller/lots', body);
      onCreated(result.lot);
    } catch (err) {
      const fields = fieldErrorsFrom(err);
      if (Object.keys(fields).length > 0) setErrors(fields);
      setApiError(
        err.status === 502
          ? 'O catálogo do Art Institute of Chicago não respondeu ao buscar a imagem da obra. Tente criar o lote de novo em instantes.'
          : fields.externalId || (Object.keys(fields).length > 0 ? 'Confira os campos destacados.' : err.message),
      );
    } finally {
      setSaving(false);
    }
  }

  const startCents = toCents(startingPrice);
  const incrementCents = toCents(increment);

  return (
    <form className="new-lot-layout" onSubmit={submit} noValidate>
      <Card as="aside" className="chosen-artwork">
        {imageFailed ? (
          <span className="catalog-noimage">
            <ImageOff size={32} aria-label="Imagem indisponível" />
          </span>
        ) : (
          <img className="artwork-image" src={item.imageUrl} alt={item.title} onError={() => setImageFailed(true)} />
        )}
        <div>
          <span className="eyebrow">Obra escolhida</span>
          <h2>{item.title}</h2>
          <dl>
            <div>
              <dt>Artista</dt>
              <dd>{item.artist ?? '—'}</dd>
            </div>
            <div>
              <dt>Data</dt>
              <dd>{item.dateDisplay ?? '—'}</dd>
            </div>
            <div>
              <dt>Técnica</dt>
              <dd>{item.medium ?? '—'}</dd>
            </div>
            <div>
              <dt>Dimensões</dt>
              <dd>{item.dimensions ?? '—'}</dd>
            </div>
          </dl>
          <p className="chosen-note">Dados do catálogo do Art Institute of Chicago, só para leitura.</p>
          <Button variant="outline" size="sm" onClick={onBack} disabled={saving}>
            Trocar obra
          </Button>
        </div>
      </Card>

      <Card className="lot-form">
        {apiError && <Alert tone="danger">{apiError}</Alert>}

        <fieldset>
          <legend>Valores</legend>
          <div className="form-row">
            <Input
              label="Lance inicial (valor mínimo)"
              prefix="R$"
              inputMode="decimal"
              placeholder="0,00"
              value={startingPrice}
              onChange={(e) => setStartingPrice(e.target.value)}
              error={errors.startingPriceCents}
              hint="O primeiro lance precisa ser igual ou maior que este valor."
            />
            <Input
              label="Incremento mínimo"
              prefix="R$"
              inputMode="decimal"
              placeholder="0,00"
              value={increment}
              onChange={(e) => setIncrement(e.target.value)}
              error={errors.minIncrementCents}
              hint="Cada lance seguinte precisa superar o atual em pelo menos este valor."
            />
          </div>
          {startCents !== null && incrementCents !== null && startCents >= MIN_CENTS && incrementCents >= MIN_CENTS && (
            <p className="form-preview">
              Primeiro lance a partir de <strong>{formatBRL(startCents)}</strong>; depois, cada lance sobe pelo menos{' '}
              <strong>{formatBRL(incrementCents)}</strong>.
            </p>
          )}
        </fieldset>

        <fieldset>
          <legend>Horários (horário de Brasília)</legend>
          <div className="start-mode" role="radiogroup" aria-label="Início">
            <label className={startMode === 'now' ? 'active' : ''}>
              <input type="radio" name="startMode" value="now" checked={startMode === 'now'} onChange={() => setStartMode('now')} />
              Começar agora
            </label>
            <label className={startMode === 'schedule' ? 'active' : ''}>
              <input
                type="radio"
                name="startMode"
                value="schedule"
                checked={startMode === 'schedule'}
                onChange={() => setStartMode('schedule')}
              />
              Agendar início
            </label>
          </div>
          <div className="form-row">
            {startMode === 'schedule' ? (
              <Input
                label="Início"
                type="datetime-local"
                min={brasiliaLocalNow()}
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                error={errors.startsAt}
                hint="Horário de Brasília"
              />
            ) : (
              <div className="field">
                <span>Início</span>
                <p className="start-now">Assim que você criar o lote.</p>
                {errors.startsAt && <small className="field-error">{errors.startsAt}</small>}
              </div>
            )}
            <Input
              label="Fim"
              type="datetime-local"
              min={brasiliaLocalNow()}
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              error={errors.endsAt}
              hint="Horário de Brasília. De 2 minutos a 30 dias depois do início."
            />
          </div>
          <p className="form-preview">
            Lance nos últimos 2 minutos prorroga o fim em mais 2 minutos, para ninguém ganhar no último segundo.
          </p>
        </fieldset>

        <fieldset>
          <legend>Descrição (opcional)</legend>
          <div className="field">
            <label htmlFor="lot-description" className="sr-only">
              Descrição
            </label>
            <textarea
              id="lot-description"
              className={`textarea ${errors.description ? 'has-error' : ''}`}
              rows={4}
              maxLength={DESCRIPTION_MAX}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Conte algo sobre a obra ou sobre o lote."
              aria-invalid={errors.description ? true : undefined}
              aria-describedby="lot-description-note"
            />
            <small id="lot-description-note" className={errors.description ? 'field-error' : undefined}>
              {errors.description ?? `${description.length} de ${DESCRIPTION_MAX} caracteres`}
            </small>
          </div>
        </fieldset>

        <div className="form-actions">
          <Button variant="ghost" onClick={onBack} disabled={saving}>
            Voltar
          </Button>
          <Button type="submit" loading={saving}>
            Criar lote
          </Button>
        </div>
      </Card>
    </form>
  );
}

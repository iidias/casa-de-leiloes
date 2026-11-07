// Vitrine de lotes (PDF: "separando lotes ao vivo, agendados e encerrados.
// Lotes cancelados não aparecem na vitrine"). O backend já filtra os cancelados.
// As três fases são buscadas juntas para cada aba mostrar seu contador. A lista se
// atualiza sozinha a cada 15 s (preço e número de lances) e também quando um
// contador zera, porque o lote muda de aba. A sala do lote usa tempo real (SSE);
// aqui um intervalo curto basta.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Gavel } from 'lucide-react';
import { api } from '../api/client.js';
import Alert from '../components/Alert.jsx';
import Card from '../components/Card.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ErrorState from '../components/ErrorState.jsx';
import LotCard from '../components/LotCard.jsx';
import PageTitle from '../components/PageTitle.jsx';
import Skeleton from '../components/Skeleton.jsx';

const TABS = [
  { phase: 'LIVE', slug: 'ao-vivo', label: 'Ao vivo', empty: 'Nenhum lote ao vivo agora', hint: 'Veja os agendados para saber quando o próximo abre.' },
  { phase: 'SCHEDULED', slug: 'agendados', label: 'Agendados', empty: 'Nenhum lote agendado', hint: 'Novos lotes aparecem aqui assim que forem publicados.' },
  { phase: 'ENDED', slug: 'encerrados', label: 'Encerrados', empty: 'Nenhum lote encerrado ainda', hint: 'Os resultados aparecem aqui quando um lote termina.' },
];
const REFRESH_MS = 15_000;
// A API devolve no máximo 100 lotes por fase; acima disso o contador mostra "100+".
const PAGE_LIMIT = 100;

function useLotsByPhase() {
  const [data, setData] = useState(null); // { LIVE: [], SCHEDULED: [], ENDED: [] }
  const [error, setError] = useState(null);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const controller = useRef(null);
  const loaded = useRef(false);

  const load = useCallback(async () => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    try {
      const results = await Promise.all(
        TABS.map((tab) => api.get(`/lots?phase=${tab.phase}`, { auth: false, signal: current.signal })),
      );
      if (current.signal.aborted) return;
      loaded.current = true;
      setData(Object.fromEntries(TABS.map((tab, i) => [tab.phase, results[i].lots])));
      setError(null);
      setRefreshFailed(false);
    } catch (err) {
      if (err?.name === 'AbortError' || current.signal.aborted) return;
      // Se já há lotes na tela, mantém e só avisa; sem nada carregado, mostra o erro.
      if (loaded.current) setRefreshFailed(true);
      else setError(err);
    }
  }, []);

  useEffect(() => {
    // O load só muda estado depois da resposta da API (após o await), não durante o efeito.
    // oxlint-disable-next-line react/set-state-in-effect
    load();
    const id = setInterval(() => {
      if (!document.hidden) load();
    }, REFRESH_MS);
    const onVisible = () => {
      if (!document.hidden) load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      controller.current?.abort();
    };
  }, [load]);

  const retry = useCallback(() => {
    setError(null);
    load();
  }, [load]);

  return { data, error, refreshFailed, reload: load, retry };
}

function LoadingGrid() {
  return (
    <div className="lot-grid" aria-busy="true" aria-label="Carregando lotes">
      {[1, 2, 3, 4].map((item) => (
        <Card key={item} className="lot-card">
          <Skeleton className="skeleton-image" />
          <div className="lot-body">
            <Skeleton className="skeleton-title" />
            <Skeleton className="skeleton-copy" />
          </div>
          <div className="lot-footer">
            <Skeleton className="skeleton-value" />
          </div>
        </Card>
      ))}
    </div>
  );
}

export default function Lots() {
  const [searchParams, setSearchParams] = useSearchParams();
  const active = TABS.find((tab) => tab.slug === searchParams.get('fase')) ?? TABS[0];
  const { data, error, refreshFailed, reload, retry } = useLotsByPhase();

  const selectTab = (tab) => {
    setSearchParams(tab === TABS[0] ? {} : { fase: tab.slug }, { replace: true });
  };

  // Setas do teclado entre as abas (padrão de acessibilidade para tablist).
  const onTabKey = (event) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (!step) return;
    const next = TABS[(TABS.indexOf(active) + step + TABS.length) % TABS.length];
    selectTab(next);
    document.getElementById(`aba-${next.slug}`)?.focus();
  };

  const lots = data?.[active.phase] ?? [];

  return (
    <div className="page content">
      <PageTitle title="Lotes">Obras selecionadas para disputas transparentes, ao vivo e auditáveis.</PageTitle>

      <div className="tabs" role="tablist" aria-label="Fases dos lotes" onKeyDown={onTabKey}>
        {TABS.map((tab) => {
          const count = data?.[tab.phase]?.length;
          const selected = tab === active;
          return (
            <button
              key={tab.phase}
              id={`aba-${tab.slug}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls="lista-de-lotes"
              tabIndex={selected ? 0 : -1}
              className={selected ? 'active' : ''}
              onClick={() => selectTab(tab)}
            >
              {tab.label}
              {count !== undefined && <span>{count >= PAGE_LIMIT ? `${PAGE_LIMIT}+` : count}</span>}
            </button>
          );
        })}
      </div>

      <div id="lista-de-lotes" role="tabpanel" aria-labelledby={`aba-${active.slug}`}>
        {refreshFailed && (
          <div className="mb-6">
            <Alert tone="warning">Não foi possível atualizar a lista agora. Tentando de novo em instantes.</Alert>
          </div>
        )}

        {error ? (
          <Card>
            <ErrorState
              title="Não foi possível carregar os lotes"
              message={error.status === 0 ? error.message : 'Tente novamente em alguns instantes.'}
              onRetry={retry}
            />
          </Card>
        ) : !data ? (
          <LoadingGrid />
        ) : lots.length === 0 ? (
          <Card>
            <EmptyState icon={Gavel} title={active.empty}>
              {active.hint}
            </EmptyState>
          </Card>
        ) : (
          <div className="lot-grid">
            {lots.map((lot) => (
              <LotCard key={lot.id} lot={lot} onPhaseChange={reload} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

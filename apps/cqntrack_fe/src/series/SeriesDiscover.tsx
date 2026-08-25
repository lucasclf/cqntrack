import type {
  DiscoverSeriesResponse,
  SearchSeriesResponse,
  SeriesSummaryWithEntry,
} from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { apiClient } from "../lib/api-client";
import { useDebouncedValue } from "../lib/useDebouncedValue";
import styles from "./SeriesDiscover.module.css";
import { SeriesCard } from "./SeriesCard";

const SEARCH_DEBOUNCE_MS = 300;

type LoadStatus = "loading" | "idle" | "error";

// Aba "Descobrir" de SeriesCategoryPanel — populares da própria TMDB
// (mesmo espírito de MovieDiscover, "carregar mais") quando o campo de
// busca está vazio; digitar substitui a lista pelos resultados de
// /api/series/search NA MESMA tela (sem navegar pra /series/buscar, ver
// SeriesCategoryPanel — bug real reportado: a busca "jogava" pra uma
// página separada em vez de só trocar a lista). A busca é espelhada em
// `?q=` da própria URL da seção, então abrir uma série e voltar restaura
// a busca (SeriesCategoryPanel decide a aba inicial pela presença desse
// `q`); limpar o campo volta a mostrar as populares. Sem <h1> próprio:
// sempre embutido dentro da seção, nunca mais uma rota própria.
export function SeriesDiscover() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS).trim();
  const isSearching = debouncedQuery !== "";

  const [results, setResults] = useState<SeriesSummaryWithEntry[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState<LoadStatus>("loading");

  // Volta pra "loading"/página 1 assim que a busca liga/desliga ou muda —
  // ou, só no modo populares (sem busca), quando a página muda — feito
  // durante o render (mesmo padrão de MovieDiscover/*Search.tsx), não
  // dentro do efeito de fetch abaixo.
  const [trackedQuery, setTrackedQuery] = useState(debouncedQuery);
  const [trackedPage, setTrackedPage] = useState(page);
  if (debouncedQuery !== trackedQuery) {
    setTrackedQuery(debouncedQuery);
    setTrackedPage(1);
    setPage(1);
    setStatus("loading");
  } else if (page !== trackedPage) {
    setTrackedPage(page);
    setStatus("loading");
  }

  // Espelha a busca pra URL (?q=) — sobrevive a navegação (abrir uma série
  // e voltar já mostra a busca de novo, ver comentário da função). Precisa
  // ser um efeito, não o bloco de ajuste acima: setSearchParams atualiza o
  // estado do RouterProvider (um componente diferente), chamar isso
  // durante o render dispara o aviso do React "Cannot update a component
  // while rendering a different component".
  useEffect(() => {
    setSearchParams(debouncedQuery ? { q: debouncedQuery } : {}, { replace: true });
  }, [debouncedQuery, setSearchParams]);

  useEffect(() => {
    let cancelled = false;

    const request = isSearching
      ? apiClient
          .get<SearchSeriesResponse>(`/api/series/search?q=${encodeURIComponent(debouncedQuery)}`)
          .then((data) => ({ results: data.results, hasMore: false }))
      : apiClient.get<DiscoverSeriesResponse>(`/api/series/discover?page=${page}`);

    request
      .then((data) => {
        if (cancelled) return;
        setResults((current) => (page === 1 ? data.results : [...current, ...data.results]));
        setHasMore(data.hasMore);
        setStatus("idle");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [isSearching, debouncedQuery, page]);

  return (
    <div className={styles.page}>
      <input
        type="search"
        className={styles.input}
        placeholder="Nome da série..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label="Buscar séries"
      />

      {status === "error" && (
        <p role="alert">
          Falha ao carregar {isSearching ? "a busca" : "séries populares"}. Tente novamente.
        </p>
      )}
      {isSearching && status === "idle" && results.length === 0 && (
        <p className={styles.hint}>Nenhuma série encontrada para &quot;{debouncedQuery}&quot;.</p>
      )}

      <div className={styles.grid}>
        {results.map((series) => (
          <SeriesCard key={series.tmdbId} series={series} entry={series.entry} interactive />
        ))}
      </div>

      {status === "loading" && <p className={styles.hint}>Carregando...</p>}

      {!isSearching && hasMore && status !== "loading" && (
        <div className={styles.loadMore}>
          <button type="button" onClick={() => setPage((current) => current + 1)}>
            Carregar mais
          </button>
        </div>
      )}
    </div>
  );
}

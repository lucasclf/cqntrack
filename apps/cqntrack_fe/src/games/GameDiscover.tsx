import {
  GAME_DISCOVER_PLATFORMS,
  GAME_DISCOVER_PLATFORM_LABELS,
  type DiscoverGamesResponse,
  type GameDiscoverPlatform,
  type GameSummaryWithEntry,
  type SearchGamesResponse,
} from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { apiClient } from "../lib/api-client";
import { useDebouncedValue } from "../lib/useDebouncedValue";
import styles from "./GameDiscover.module.css";
import { GameCard } from "./GameCard";

const SEARCH_DEBOUNCE_MS = 300;

type LoadStatus = "loading" | "idle" | "error";

// Aba "Descobrir" de GameCategoryPanel — aclamados da própria IGDB (mesmo
// espírito de MovieDiscover/SeriesDiscover, "carregar mais") quando o
// campo de busca está vazio; digitar substitui a lista pelos resultados
// de /api/games/search NA MESMA tela (sem navegar pra /jogos/buscar, ver
// GameCategoryPanel — bug real reportado: a busca "jogava" pra uma página
// separada em vez de só trocar a lista). A busca é espelhada em `?q=` da
// própria URL da seção, então abrir um jogo e voltar restaura a busca
// (GameCategoryPanel decide a aba inicial pela presença desse `q`); limpar
// o campo volta a mostrar os aclamados. Sem <h1> próprio: sempre embutido
// dentro da seção, nunca mais uma rota própria.
export function GameDiscover() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS).trim();
  const isSearching = debouncedQuery !== "";

  const [results, setResults] = useState<GameSummaryWithEntry[]>([]);
  const [page, setPage] = useState(1);
  const [platform, setPlatform] = useState<GameDiscoverPlatform | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState<LoadStatus>("loading");

  // Volta pra "loading"/página 1 assim que a busca liga/desliga ou muda —
  // ou, só no modo aclamados (sem busca), quando a página ou a plataforma
  // mudam — feito durante o render (mesmo padrão de MovieDiscover/
  // *Search.tsx), não dentro do efeito de fetch abaixo.
  const [trackedQuery, setTrackedQuery] = useState(debouncedQuery);
  const [trackedPage, setTrackedPage] = useState(page);
  const [trackedPlatform, setTrackedPlatform] = useState(platform);
  if (debouncedQuery !== trackedQuery) {
    setTrackedQuery(debouncedQuery);
    setTrackedPage(1);
    setPage(1);
    setStatus("loading");
  } else if (page !== trackedPage || platform !== trackedPlatform) {
    setTrackedPage(page);
    setTrackedPlatform(platform);
    setStatus("loading");
  }

  function selectPlatform(next: GameDiscoverPlatform | null) {
    setPlatform(next);
    setPage(1);
  }

  // Espelha a busca pra URL (?q=) — sobrevive a navegação (abrir um jogo e
  // voltar já mostra a busca de novo, ver comentário da função). Precisa
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
          .get<SearchGamesResponse>(`/api/games/search?q=${encodeURIComponent(debouncedQuery)}`)
          .then((data) => ({ results: data.results, hasMore: false }))
      : apiClient.get<DiscoverGamesResponse>(
          `/api/games/discover?${new URLSearchParams({
            page: String(page),
            ...(platform ? { platform } : {}),
          })}`,
        );

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
  }, [isSearching, debouncedQuery, page, platform]);

  return (
    <div className={styles.page}>
      <input
        type="search"
        className={styles.input}
        placeholder="Nome do jogo..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label="Buscar jogos"
      />

      {!isSearching && (
        <div className={styles.platformFilters} role="group" aria-label="Filtrar por plataforma">
          <button
            type="button"
            className={styles.platformChip}
            aria-pressed={platform === null}
            onClick={() => selectPlatform(null)}
          >
            Todas
          </button>
          {GAME_DISCOVER_PLATFORMS.map((option) => (
            <button
              key={option}
              type="button"
              className={styles.platformChip}
              aria-pressed={platform === option}
              onClick={() => selectPlatform(option)}
            >
              {GAME_DISCOVER_PLATFORM_LABELS[option]}
            </button>
          ))}
        </div>
      )}

      {status === "error" && (
        <p role="alert">
          Falha ao carregar {isSearching ? "a busca" : "jogos aclamados"}. Tente novamente.
        </p>
      )}
      {isSearching && status === "idle" && results.length === 0 && (
        <p className={styles.hint}>Nenhum jogo encontrado para &quot;{debouncedQuery}&quot;.</p>
      )}

      <div className={styles.grid}>
        {results.map((game) => (
          <GameCard key={game.igdbId} game={game} entry={game.entry} interactive />
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

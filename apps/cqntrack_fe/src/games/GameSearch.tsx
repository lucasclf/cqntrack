import type { GameSummary, SearchGamesResponse } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { apiClient } from "../lib/api-client";
import { GameCard } from "./GameCard";
import styles from "./GameSearch.module.css";
import { useDebouncedValue } from "../lib/useDebouncedValue";

const SEARCH_DEBOUNCE_MS = 300;

type SearchStatus = "idle" | "loading" | "error";

export function GameSearch() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS).trim();
  const [results, setResults] = useState<GameSummary[]>([]);
  const [status, setStatus] = useState<SearchStatus>("idle");

  // Ajusta o status assim que a query debounced muda — feito durante o
  // render (padrão recomendado pelo React pra "adjusting state when props
  // change"), não dentro do efeito, que fica só com a chamada assíncrona.
  // Também espelha a query pra URL (?q=), pra sobreviver a navegação e dar
  // ao botão "Voltar" um resultado pra restaurar (ver BackButton).
  const [trackedQuery, setTrackedQuery] = useState(debouncedQuery);
  if (debouncedQuery !== trackedQuery) {
    setTrackedQuery(debouncedQuery);
    setStatus(debouncedQuery ? "loading" : "idle");
    if (!debouncedQuery) {
      setResults([]);
    }
    setSearchParams(debouncedQuery ? { q: debouncedQuery } : {}, { replace: true });
  }

  useEffect(() => {
    if (!debouncedQuery) {
      return;
    }

    let cancelled = false;

    apiClient
      .get<SearchGamesResponse>(`/api/games/search?q=${encodeURIComponent(debouncedQuery)}`)
      .then((data) => {
        if (!cancelled) {
          setResults(data.results);
          setStatus("idle");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const hasQuery = debouncedQuery !== "";

  return (
    <div className={styles.page}>
      <h1>Buscar jogos</h1>
      <input
        type="search"
        className={styles.input}
        placeholder="Nome do jogo..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label="Buscar jogos"
      />
      {hasQuery && status === "error" && (
        <p role="alert">Falha ao buscar jogos. Tente novamente.</p>
      )}
      {hasQuery && status === "loading" && <p className={styles.hint}>Buscando...</p>}
      {hasQuery && status === "idle" && results.length === 0 && (
        <p className={styles.hint}>Nenhum jogo encontrado para &quot;{debouncedQuery}&quot;.</p>
      )}
      <div className={styles.grid}>
        {results.map((game) => (
          <GameCard key={game.igdbId} game={game} />
        ))}
      </div>
    </div>
  );
}

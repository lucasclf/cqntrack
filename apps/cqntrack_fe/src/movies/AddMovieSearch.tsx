import type { MovieSummary, SearchMoviesResponse } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { apiClient } from "../lib/api-client";
import { useDebouncedValue } from "../lib/useDebouncedValue";
import styles from "./AddMovieSearch.module.css";

const SEARCH_DEBOUNCE_MS = 300;

interface AddMovieSearchProps {
  onAdd: (movie: MovieSummary) => Promise<void> | void;
  addedIds?: ReadonlySet<number>;
}

// Busca compacta reutilizada onde faz sentido adicionar um filme a algo (por
// ora, só MovieListDetail) sem sair da página — mesmo debounce de
// MovieSearch.
export function AddMovieSearch({ onAdd, addedIds }: AddMovieSearchProps) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS).trim();
  const [results, setResults] = useState<MovieSummary[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [addingId, setAddingId] = useState<number | null>(null);

  const [trackedQuery, setTrackedQuery] = useState(debouncedQuery);
  if (debouncedQuery !== trackedQuery) {
    setTrackedQuery(debouncedQuery);
    setStatus(debouncedQuery ? "loading" : "idle");
    if (!debouncedQuery) {
      setResults([]);
    }
  }

  useEffect(() => {
    if (!debouncedQuery) {
      return;
    }

    let cancelled = false;

    apiClient
      .get<SearchMoviesResponse>(`/api/movies/search?q=${encodeURIComponent(debouncedQuery)}`)
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

  async function handleAdd(movie: MovieSummary) {
    setAddingId(movie.tmdbId);
    try {
      await onAdd(movie);
      // Zera a busca assim que adiciona — não espera o debounce pra sumir
      // com o input/resultados.
      setQuery("");
      setResults([]);
      setStatus("idle");
    } finally {
      setAddingId(null);
    }
  }

  const hasQuery = debouncedQuery !== "";

  return (
    <div className={styles.wrapper}>
      <input
        type="search"
        className={styles.input}
        placeholder="Buscar filme pra adicionar..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label="Buscar filme pra adicionar à lista"
      />
      {hasQuery && status === "error" && <p role="alert">Falha ao buscar filmes.</p>}
      {hasQuery && status === "loading" && <p className={styles.hint}>Buscando...</p>}
      {hasQuery && status === "idle" && results.length === 0 && (
        <p className={styles.hint}>Nenhum filme encontrado.</p>
      )}
      {results.length > 0 && (
        <ul className={styles.results}>
          {results.map((movie) => {
            const alreadyAdded = addedIds?.has(movie.tmdbId) ?? false;
            const isAdding = addingId === movie.tmdbId;
            return (
              <li key={movie.tmdbId} className={styles.resultItem}>
                <span>{movie.name}</span>
                <button
                  type="button"
                  disabled={alreadyAdded || isAdding}
                  onClick={() => handleAdd(movie)}
                >
                  {alreadyAdded ? "Já na lista" : isAdding ? "Adicionando..." : "Adicionar"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

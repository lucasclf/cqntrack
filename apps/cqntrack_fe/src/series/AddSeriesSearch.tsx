import type { SearchSeriesResponse, SeriesSummary } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { apiClient } from "../lib/api-client";
import { useDebouncedValue } from "../lib/useDebouncedValue";
import styles from "./AddSeriesSearch.module.css";

const SEARCH_DEBOUNCE_MS = 300;

interface AddSeriesSearchProps {
  onAdd: (series: SeriesSummary) => Promise<void> | void;
  addedIds?: ReadonlySet<number>;
}

// Busca compacta reutilizada onde faz sentido adicionar uma série a algo (por
// ora, só SeriesListDetail) sem sair da página — mesmo debounce de
// SeriesSearch.
export function AddSeriesSearch({ onAdd, addedIds }: AddSeriesSearchProps) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS).trim();
  const [results, setResults] = useState<SeriesSummary[]>([]);
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
      .get<SearchSeriesResponse>(`/api/series/search?q=${encodeURIComponent(debouncedQuery)}`)
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

  async function handleAdd(series: SeriesSummary) {
    setAddingId(series.tmdbId);
    try {
      await onAdd(series);
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
        placeholder="Buscar série pra adicionar..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label="Buscar série pra adicionar à lista"
      />
      {hasQuery && status === "error" && <p role="alert">Falha ao buscar séries.</p>}
      {hasQuery && status === "loading" && <p className={styles.hint}>Buscando...</p>}
      {hasQuery && status === "idle" && results.length === 0 && (
        <p className={styles.hint}>Nenhuma série encontrada.</p>
      )}
      {results.length > 0 && (
        <ul className={styles.results}>
          {results.map((series) => {
            const alreadyAdded = addedIds?.has(series.tmdbId) ?? false;
            const isAdding = addingId === series.tmdbId;
            return (
              <li key={series.tmdbId} className={styles.resultItem}>
                <span>{series.name}</span>
                <button
                  type="button"
                  disabled={alreadyAdded || isAdding}
                  onClick={() => handleAdd(series)}
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

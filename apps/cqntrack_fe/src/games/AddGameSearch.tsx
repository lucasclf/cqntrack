import type { GameSummary, SearchGamesResponse } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { apiClient } from "../lib/api-client";
import styles from "./AddGameSearch.module.css";
import { useDebouncedValue } from "../lib/useDebouncedValue";

const SEARCH_DEBOUNCE_MS = 300;

interface AddGameSearchProps {
  onAdd: (game: GameSummary) => Promise<void> | void;
  addedIds?: ReadonlySet<number>;
}

// Busca compacta reutilizada onde faz sentido adicionar um jogo a algo (por
// ora, só ListDetail) sem sair da página — mesmo debounce de GameSearch.
export function AddGameSearch({ onAdd, addedIds }: AddGameSearchProps) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS).trim();
  const [results, setResults] = useState<GameSummary[]>([]);
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

  async function handleAdd(game: GameSummary) {
    setAddingId(game.igdbId);
    try {
      await onAdd(game);
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
        placeholder="Buscar jogo pra adicionar..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label="Buscar jogo pra adicionar à lista"
      />
      {hasQuery && status === "error" && <p role="alert">Falha ao buscar jogos.</p>}
      {hasQuery && status === "loading" && <p className={styles.hint}>Buscando...</p>}
      {hasQuery && status === "idle" && results.length === 0 && (
        <p className={styles.hint}>Nenhum jogo encontrado.</p>
      )}
      {results.length > 0 && (
        <ul className={styles.results}>
          {results.map((game) => {
            const alreadyAdded = addedIds?.has(game.igdbId) ?? false;
            const isAdding = addingId === game.igdbId;
            return (
              <li key={game.igdbId} className={styles.resultItem}>
                <span>{game.name}</span>
                <button
                  type="button"
                  disabled={alreadyAdded || isAdding}
                  onClick={() => handleAdd(game)}
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

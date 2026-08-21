import type { MangaSummary, SearchMangaResponse } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { apiClient } from "../lib/api-client";
import { useDebouncedValue } from "../lib/useDebouncedValue";
import styles from "./AddMangaSearch.module.css";

const SEARCH_DEBOUNCE_MS = 300;

interface AddMangaSearchProps {
  onAdd: (manga: MangaSummary) => Promise<void> | void;
  addedIds?: ReadonlySet<string>;
}

// Busca compacta reutilizada onde faz sentido adicionar um mangá a algo
// (por ora, só MangaListDetail) sem sair da página — mesmo padrão de
// AddBookSearch.
export function AddMangaSearch({ onAdd, addedIds }: AddMangaSearchProps) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS).trim();
  const [results, setResults] = useState<MangaSummary[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [addingId, setAddingId] = useState<string | null>(null);

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
      .get<SearchMangaResponse>(`/api/manga/search?q=${encodeURIComponent(debouncedQuery)}`)
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

  async function handleAdd(manga: MangaSummary) {
    setAddingId(manga.mangadexId);
    try {
      await onAdd(manga);
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
        placeholder="Buscar mangá pra adicionar..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label="Buscar mangá pra adicionar à lista"
      />
      {hasQuery && status === "error" && <p role="alert">Falha ao buscar mangás.</p>}
      {hasQuery && status === "loading" && <p className={styles.hint}>Buscando...</p>}
      {hasQuery && status === "idle" && results.length === 0 && (
        <p className={styles.hint}>Nenhum mangá encontrado.</p>
      )}
      {results.length > 0 && (
        <ul className={styles.results}>
          {results.map((manga) => {
            const alreadyAdded = addedIds?.has(manga.mangadexId) ?? false;
            const isAdding = addingId === manga.mangadexId;
            return (
              <li key={manga.mangadexId} className={styles.resultItem}>
                <span>{manga.title}</span>
                <button
                  type="button"
                  disabled={alreadyAdded || isAdding}
                  onClick={() => handleAdd(manga)}
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

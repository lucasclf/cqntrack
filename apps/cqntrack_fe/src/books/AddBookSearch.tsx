import type { BookSummary, SearchBooksResponse } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { apiClient } from "../lib/api-client";
import { useDebouncedValue } from "../lib/useDebouncedValue";
import styles from "./AddBookSearch.module.css";

const SEARCH_DEBOUNCE_MS = 300;

interface AddBookSearchProps {
  onAdd: (book: BookSummary) => Promise<void> | void;
  addedIds?: ReadonlySet<string>;
}

// Busca compacta reutilizada onde faz sentido adicionar um livro a algo (por
// ora, só BookListDetail) sem sair da página — mesmo debounce de
// BookSearch.
export function AddBookSearch({ onAdd, addedIds }: AddBookSearchProps) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS).trim();
  const [results, setResults] = useState<BookSummary[]>([]);
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
      .get<SearchBooksResponse>(`/api/books/search?q=${encodeURIComponent(debouncedQuery)}`)
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

  async function handleAdd(book: BookSummary) {
    setAddingId(book.googleBooksId);
    try {
      await onAdd(book);
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
        placeholder="Buscar livro pra adicionar..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label="Buscar livro pra adicionar à lista"
      />
      {hasQuery && status === "error" && <p role="alert">Falha ao buscar livros.</p>}
      {hasQuery && status === "loading" && <p className={styles.hint}>Buscando...</p>}
      {hasQuery && status === "idle" && results.length === 0 && (
        <p className={styles.hint}>Nenhum livro encontrado.</p>
      )}
      {results.length > 0 && (
        <ul className={styles.results}>
          {results.map((book) => {
            const alreadyAdded = addedIds?.has(book.googleBooksId) ?? false;
            const isAdding = addingId === book.googleBooksId;
            return (
              <li key={book.googleBooksId} className={styles.resultItem}>
                <span>{book.title}</span>
                <button
                  type="button"
                  disabled={alreadyAdded || isAdding}
                  onClick={() => handleAdd(book)}
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

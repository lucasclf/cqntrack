import type { BookSummary, SearchBooksResponse } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { apiClient } from "../lib/api-client";
import { useDebouncedValue } from "../lib/useDebouncedValue";
import { BookCard } from "./BookCard";
import styles from "./BookSearch.module.css";

const SEARCH_DEBOUNCE_MS = 300;

type SearchStatus = "idle" | "loading" | "error";

export function BookSearch() {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS).trim();
  const [results, setResults] = useState<BookSummary[]>([]);
  const [status, setStatus] = useState<SearchStatus>("idle");

  // Ajusta o status assim que a query debounced muda — feito durante o
  // render (padrão recomendado pelo React pra "adjusting state when props
  // change"), não dentro do efeito, que fica só com a chamada assíncrona.
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

  const hasQuery = debouncedQuery !== "";

  return (
    <div className={styles.page}>
      <h1>Buscar livros</h1>
      <input
        type="search"
        className={styles.input}
        placeholder="Título do livro..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label="Buscar livros"
      />
      {hasQuery && status === "error" && <p role="alert">Falha ao buscar livros. Tente novamente.</p>}
      {hasQuery && status === "loading" && <p className={styles.hint}>Buscando...</p>}
      {hasQuery && status === "idle" && results.length === 0 && (
        <p className={styles.hint}>Nenhum livro encontrado para &quot;{debouncedQuery}&quot;.</p>
      )}
      <div className={styles.grid}>
        {results.map((book) => (
          <BookCard key={book.googleBooksId} book={book} />
        ))}
      </div>
    </div>
  );
}

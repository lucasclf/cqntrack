import type { MovieSummary, SearchMoviesResponse } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { apiClient } from "../lib/api-client";
import { useDebouncedValue } from "../lib/useDebouncedValue";
import styles from "./MovieFavoritePickerModal.module.css";

const SEARCH_DEBOUNCE_MS = 300;

interface MovieFavoritePickerModalProps {
  onSelect: (movie: MovieSummary) => void;
  onClose: () => void;
}

// Popup de busca reaproveitado pros dois casos de favorito: preencher um
// slot vazio ou trocar o filme de um slot já preenchido.
export function MovieFavoritePickerModal({ onSelect, onClose }: MovieFavoritePickerModalProps) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS).trim();
  const [results, setResults] = useState<MovieSummary[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

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

  const hasQuery = debouncedQuery !== "";

  return (
    <div className={styles.overlay} role="presentation" onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label="Escolher filme favorito"
        onClick={(event) => event.stopPropagation()}
      >
        <h2>Escolher favorito</h2>
        <input
          type="search"
          className={styles.input}
          placeholder="Buscar filme..."
          value={query}
          autoFocus
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Buscar filme"
        />
        {hasQuery && status === "error" && <p role="alert">Falha ao buscar filmes.</p>}
        {hasQuery && status === "loading" && <p className={styles.hint}>Buscando...</p>}
        {hasQuery && status === "idle" && results.length === 0 && (
          <p className={styles.hint}>Nenhum filme encontrado.</p>
        )}
        {results.length > 0 && (
          <ul className={styles.results}>
            {results.map((movie) => (
              <li key={movie.tmdbId}>
                <button type="button" className={styles.resultBtn} onClick={() => onSelect(movie)}>
                  {movie.posterUrl ? (
                    <img className={styles.resultCover} src={movie.posterUrl} alt="" />
                  ) : (
                    <span className={styles.resultCover} aria-hidden="true" />
                  )}
                  <span>{movie.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <button type="button" className={styles.cancelBtn} onClick={onClose}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

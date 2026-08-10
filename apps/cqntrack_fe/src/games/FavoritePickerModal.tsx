import type { GameSummary, SearchGamesResponse } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { gamesClient } from "../lib/games-client";
import styles from "./FavoritePickerModal.module.css";
import { useDebouncedValue } from "./useDebouncedValue";

const SEARCH_DEBOUNCE_MS = 300;

interface FavoritePickerModalProps {
  onSelect: (game: GameSummary) => void;
  onClose: () => void;
}

// Popup de busca reaproveitado pros dois casos de favorito: preencher um
// slot vazio ou trocar o jogo de um slot já preenchido.
export function FavoritePickerModal({ onSelect, onClose }: FavoritePickerModalProps) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS).trim();
  const [results, setResults] = useState<GameSummary[]>([]);
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

    gamesClient
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
    <div className={styles.overlay} role="presentation" onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label="Escolher jogo favorito"
        onClick={(event) => event.stopPropagation()}
      >
        <h2>Escolher favorito</h2>
        <input
          type="search"
          className={styles.input}
          placeholder="Buscar jogo..."
          value={query}
          autoFocus
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Buscar jogo"
        />
        {hasQuery && status === "error" && <p role="alert">Falha ao buscar jogos.</p>}
        {hasQuery && status === "loading" && <p className={styles.hint}>Buscando...</p>}
        {hasQuery && status === "idle" && results.length === 0 && (
          <p className={styles.hint}>Nenhum jogo encontrado.</p>
        )}
        {results.length > 0 && (
          <ul className={styles.results}>
            {results.map((game) => (
              <li key={game.igdbId}>
                <button type="button" className={styles.resultBtn} onClick={() => onSelect(game)}>
                  {game.coverUrl ? (
                    <img className={styles.resultCover} src={game.coverUrl} alt="" />
                  ) : (
                    <span className={styles.resultCover} aria-hidden="true" />
                  )}
                  <span>{game.name}</span>
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

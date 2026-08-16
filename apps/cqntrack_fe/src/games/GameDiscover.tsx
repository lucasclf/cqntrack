import type { DiscoverGamesResponse, GameSummary } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { apiClient } from "../lib/api-client";
import styles from "./GameDiscover.module.css";
import { GameCard } from "./GameCard";

type LoadStatus = "loading" | "idle" | "error";

// Índice da seção de jogos no menu superior — aclamados da própria IGDB
// (mesmo espírito de MovieDiscover/SeriesDiscover, "carregar mais").
export function GameDiscover() {
  const [results, setResults] = useState<GameSummary[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState<LoadStatus>("loading");

  // Volta pra "loading" assim que a página muda (ex.: "Carregar mais") —
  // feito durante o render (mesmo padrão de MovieDiscover), não dentro do
  // efeito abaixo.
  const [trackedPage, setTrackedPage] = useState(page);
  if (page !== trackedPage) {
    setTrackedPage(page);
    setStatus("loading");
  }

  useEffect(() => {
    let cancelled = false;

    apiClient
      .get<DiscoverGamesResponse>(`/api/games/discover?page=${page}`)
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
  }, [page]);

  return (
    <div className={styles.page}>
      <h1>Descobrir jogos</h1>
      {status === "error" && (
        <p role="alert">Falha ao carregar jogos aclamados. Tente novamente.</p>
      )}

      <div className={styles.grid}>
        {results.map((game) => (
          <GameCard key={game.igdbId} game={game} />
        ))}
      </div>

      {status === "loading" && <p className={styles.hint}>Carregando...</p>}

      {hasMore && status !== "loading" && (
        <div className={styles.loadMore}>
          <button type="button" onClick={() => setPage((current) => current + 1)}>
            Carregar mais
          </button>
        </div>
      )}
    </div>
  );
}

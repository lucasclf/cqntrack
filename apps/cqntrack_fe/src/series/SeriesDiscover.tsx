import type { DiscoverSeriesResponse, SeriesSummary } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { apiClient } from "../lib/api-client";
import styles from "./SeriesDiscover.module.css";
import { SeriesCard } from "./SeriesCard";

type LoadStatus = "loading" | "idle" | "error";

// Índice da seção de séries no menu superior — mesmo espírito de
// MovieDiscover (populares da própria TMDB, "carregar mais").
export function SeriesDiscover() {
  const [results, setResults] = useState<SeriesSummary[]>([]);
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
      .get<DiscoverSeriesResponse>(`/api/series/discover?page=${page}`)
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
      <h1>Descobrir séries</h1>
      {status === "error" && <p role="alert">Falha ao carregar séries populares. Tente novamente.</p>}

      <div className={styles.grid}>
        {results.map((series) => (
          <SeriesCard key={series.tmdbId} series={series} />
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

import type { DiscoverSeriesResponse, SeriesSummaryWithEntry } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { MediaSearchInput } from "../components/MediaSearchInput";
import { apiClient } from "../lib/api-client";
import styles from "./SeriesDiscover.module.css";
import { SeriesCard } from "./SeriesCard";

type LoadStatus = "loading" | "idle" | "error";

// Aba "Descobrir" de SeriesCategoryPanel — mesmo espírito de MovieDiscover
// (populares da própria TMDB, "carregar mais"). Sem <h1> próprio: sempre
// embutido dentro da seção, nunca mais uma rota própria.
export function SeriesDiscover() {
  const [results, setResults] = useState<SeriesSummaryWithEntry[]>([]);
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
      <MediaSearchInput
        sectionPath="/series"
        placeholder="Nome da série..."
        ariaLabel="Buscar séries"
      />
      {status === "error" && (
        <p role="alert">Falha ao carregar séries populares. Tente novamente.</p>
      )}

      <div className={styles.grid}>
        {results.map((series) => (
          <SeriesCard key={series.tmdbId} series={series} entry={series.entry} interactive />
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

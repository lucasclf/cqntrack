import type { PaginatedMovieEntriesResponse } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { apiClient } from "../lib/api-client";
import { MovieCard } from "./MovieCard";
import { MovieEntryFilters, type MovieEntrySortField, type WatchedFilter } from "./MovieEntryFilters";
import styles from "./MyMovieEntries.module.css";

type LoadStatus = "loading" | "ready" | "error";

export function MyMovieEntries() {
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [watched, setWatched] = useState<WatchedFilter>("");
  const [sortBy, setSortBy] = useState<MovieEntrySortField>("updatedAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  // Volta pra página 1 sempre que um filtro/ordenação muda — ajustado durante
  // o render (mesmo padrão de MySeriesEntries), não dentro do efeito.
  const filtersKey = JSON.stringify({ favoriteOnly, watched, sortBy, order });
  const [trackedFiltersKey, setTrackedFiltersKey] = useState(filtersKey);
  if (filtersKey !== trackedFiltersKey) {
    setTrackedFiltersKey(filtersKey);
    setPage(1);
  }

  const [data, setData] = useState<PaginatedMovieEntriesResponse | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (favoriteOnly) params.set("favorite", "true");
    if (watched) params.set("watched", watched);
    params.set("sortBy", sortBy);
    params.set("order", order);
    params.set("page", String(page));

    apiClient
      .get<PaginatedMovieEntriesResponse>(`/api/movies/entries?${params.toString()}`)
      .then((response) => {
        if (!cancelled) {
          setData(response);
          setLoadStatus("ready");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadStatus("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [favoriteOnly, watched, sortBy, order, page]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className={styles.page}>
      <h1>Meus filmes</h1>
      <MovieEntryFilters
        favoriteOnly={favoriteOnly}
        onFavoriteOnlyChange={setFavoriteOnly}
        watched={watched}
        onWatchedChange={setWatched}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        order={order}
        onOrderChange={setOrder}
      />

      {loadStatus === "loading" && !data && <p className={styles.hint}>Carregando...</p>}
      {loadStatus === "error" && (
        <p role="alert">Falha ao carregar seus filmes. Tente novamente.</p>
      )}
      {loadStatus === "ready" && data?.items.length === 0 && (
        <p className={styles.hint}>Nenhum filme encontrado com esses filtros.</p>
      )}

      {data && data.items.length > 0 && (
        <>
          <div className={styles.grid}>
            {data.items.map((item) => (
              <MovieCard key={item.movie.tmdbId} movie={item.movie} entry={item} />
            ))}
          </div>
          <div className={styles.pagination}>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((current) => current - 1)}
            >
              Anterior
            </button>
            <span className={styles.pageInfo}>
              Página {page} de {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              Próxima
            </button>
          </div>
        </>
      )}
    </div>
  );
}

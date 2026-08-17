import {
  MOVIE_STATUSES,
  type MovieStatus,
  type PaginatedMovieEntriesResponse,
} from "@cqntrack/shared";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { usePaginatedEntries } from "../lib/usePaginatedEntries";
import { MovieCard } from "./MovieCard";
import { MovieEntryFilters, type MovieEntrySortField } from "./MovieEntryFilters";
import styles from "./MyMovieEntries.module.css";

// Lida só uma vez, na montagem — é o valor inicial do filtro quando se
// chega aqui por um link com ?status= (ex.: estatística clicável da home,
// ver MovieStats); depois disso o filtro vira estado local normal, como
// sempre foi.
function initialStatusFromUrl(searchParams: URLSearchParams): MovieStatus | "" {
  const raw = searchParams.get("status");
  return raw !== null && (MOVIE_STATUSES as readonly string[]).includes(raw)
    ? (raw as MovieStatus)
    : "";
}

export function MyMovieEntries() {
  const [searchParams] = useSearchParams();
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [status, setStatus] = useState<MovieStatus | "">(() => initialStatusFromUrl(searchParams));
  const [sortBy, setSortBy] = useState<MovieEntrySortField>("updatedAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  const { data, loadStatus, page, setPage, totalPages } =
    usePaginatedEntries<PaginatedMovieEntriesResponse>(
      (page) => {
        const params = new URLSearchParams();
        if (favoriteOnly) params.set("favorite", "true");
        if (status) params.set("status", status);
        params.set("sortBy", sortBy);
        params.set("order", order);
        params.set("page", String(page));
        return `/api/movies/entries?${params.toString()}`;
      },
      { favoriteOnly, status, sortBy, order },
    );

  return (
    <div className={styles.page}>
      <h1>Meus filmes</h1>
      <MovieEntryFilters
        favoriteOnly={favoriteOnly}
        onFavoriteOnlyChange={setFavoriteOnly}
        status={status}
        onStatusChange={setStatus}
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

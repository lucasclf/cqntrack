import type { PaginatedSeriesEntriesResponse } from "@cqntrack/shared";
import { useState } from "react";
import { usePaginatedEntries } from "../lib/usePaginatedEntries";
import styles from "./MySeriesEntries.module.css";
import { SeriesCard } from "./SeriesCard";
import { SeriesEntryFilters, type SeriesEntrySortField } from "./SeriesEntryFilters";

export function MySeriesEntries() {
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SeriesEntrySortField>("updatedAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  const { data, loadStatus, page, setPage, totalPages } =
    usePaginatedEntries<PaginatedSeriesEntriesResponse>(
      (page) => {
        const params = new URLSearchParams();
        if (favoriteOnly) params.set("favorite", "true");
        params.set("sortBy", sortBy);
        params.set("order", order);
        params.set("page", String(page));
        return `/api/series/entries?${params.toString()}`;
      },
      { favoriteOnly, sortBy, order },
    );

  return (
    <div className={styles.page}>
      <h1>Minhas séries</h1>
      <SeriesEntryFilters
        favoriteOnly={favoriteOnly}
        onFavoriteOnlyChange={setFavoriteOnly}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        order={order}
        onOrderChange={setOrder}
      />

      {loadStatus === "loading" && !data && <p className={styles.hint}>Carregando...</p>}
      {loadStatus === "error" && (
        <p role="alert">Falha ao carregar suas séries. Tente novamente.</p>
      )}
      {loadStatus === "ready" && data?.items.length === 0 && (
        <p className={styles.hint}>Nenhuma série encontrada com esses filtros.</p>
      )}

      {data && data.items.length > 0 && (
        <>
          <div className={styles.grid}>
            {data.items.map((item) => (
              <SeriesCard key={item.series.tmdbId} series={item.series} entry={item} />
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

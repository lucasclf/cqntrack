import type { PaginatedSeriesEntriesResponse } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { apiClient } from "../lib/api-client";
import styles from "./MySeriesEntries.module.css";
import { SeriesCard } from "./SeriesCard";
import { SeriesEntryFilters, type SeriesEntrySortField } from "./SeriesEntryFilters";

type LoadStatus = "loading" | "ready" | "error";

export function MySeriesEntries() {
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SeriesEntrySortField>("updatedAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  // Volta pra página 1 sempre que um filtro/ordenação muda — ajustado durante
  // o render (mesmo padrão de MyEntries), não dentro do efeito.
  const filtersKey = JSON.stringify({ favoriteOnly, sortBy, order });
  const [trackedFiltersKey, setTrackedFiltersKey] = useState(filtersKey);
  if (filtersKey !== trackedFiltersKey) {
    setTrackedFiltersKey(filtersKey);
    setPage(1);
  }

  const [data, setData] = useState<PaginatedSeriesEntriesResponse | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (favoriteOnly) params.set("favorite", "true");
    params.set("sortBy", sortBy);
    params.set("order", order);
    params.set("page", String(page));

    apiClient
      .get<PaginatedSeriesEntriesResponse>(`/api/series/entries?${params.toString()}`)
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
  }, [favoriteOnly, sortBy, order, page]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

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

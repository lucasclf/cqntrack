import {
  MANGA_STATUSES,
  type MangaStatus,
  type PaginatedMangaEntriesResponse,
} from "@cqntrack/shared";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { usePaginatedEntries } from "../lib/usePaginatedEntries";
import { MangaCard } from "./MangaCard";
import { MangaEntryFilters, type MangaEntrySortField } from "./MangaEntryFilters";
import styles from "./MyMangaEntries.module.css";

// Lida só uma vez, na montagem — valor inicial do filtro quando se chega
// aqui por um link com ?status=; depois vira estado local normal.
function initialStatusFromUrl(searchParams: URLSearchParams): MangaStatus | "" {
  const raw = searchParams.get("status");
  return raw !== null && (MANGA_STATUSES as readonly string[]).includes(raw)
    ? (raw as MangaStatus)
    : "";
}

export function MyMangaEntries() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<MangaStatus | "">(() => initialStatusFromUrl(searchParams));
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [sortBy, setSortBy] = useState<MangaEntrySortField>("updatedAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  const { data, loadStatus, page, setPage, totalPages } =
    usePaginatedEntries<PaginatedMangaEntriesResponse>(
      (page) => {
        const params = new URLSearchParams();
        if (status) params.set("status", status);
        if (favoriteOnly) params.set("favorite", "true");
        params.set("sortBy", sortBy);
        params.set("order", order);
        params.set("page", String(page));
        return `/api/manga/entries?${params.toString()}`;
      },
      { status, favoriteOnly, sortBy, order },
    );

  return (
    <div className={styles.page}>
      <h1>Minhas marcações</h1>
      <MangaEntryFilters
        status={status}
        onStatusChange={setStatus}
        favoriteOnly={favoriteOnly}
        onFavoriteOnlyChange={setFavoriteOnly}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        order={order}
        onOrderChange={setOrder}
      />

      {loadStatus === "loading" && !data && <p className={styles.hint}>Carregando...</p>}
      {loadStatus === "error" && (
        <p role="alert">Falha ao carregar suas marcações. Tente novamente.</p>
      )}
      {loadStatus === "ready" && data?.items.length === 0 && (
        <p className={styles.hint}>Nenhuma marcação encontrada com esses filtros.</p>
      )}

      {data && data.items.length > 0 && (
        <>
          <div className={styles.grid}>
            {data.items.map((item) => (
              <MangaCard key={item.manga.mangadexId} manga={item.manga} entry={item} interactive />
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

import type { BookStatus, PaginatedBookEntriesResponse } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { apiClient } from "../lib/api-client";
import { BookCard } from "./BookCard";
import { BookEntryFilters, type BookEntrySortField } from "./BookEntryFilters";
import styles from "./MyBookEntries.module.css";

type LoadStatus = "loading" | "ready" | "error";

export function MyBookEntries() {
  const [status, setStatus] = useState<BookStatus | "">("");
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [sortBy, setSortBy] = useState<BookEntrySortField>("updatedAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  // Volta pra página 1 sempre que um filtro/ordenação muda — ajustado durante
  // o render (mesmo padrão de BookSearch/BookDetail), não dentro do efeito.
  const filtersKey = JSON.stringify({ status, favoriteOnly, sortBy, order });
  const [trackedFiltersKey, setTrackedFiltersKey] = useState(filtersKey);
  if (filtersKey !== trackedFiltersKey) {
    setTrackedFiltersKey(filtersKey);
    setPage(1);
  }

  const [data, setData] = useState<PaginatedBookEntriesResponse | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (favoriteOnly) params.set("favorite", "true");
    params.set("sortBy", sortBy);
    params.set("order", order);
    params.set("page", String(page));

    apiClient
      .get<PaginatedBookEntriesResponse>(`/api/books/entries?${params.toString()}`)
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
  }, [status, favoriteOnly, sortBy, order, page]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className={styles.page}>
      <h1>Minhas marcações</h1>
      <BookEntryFilters
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
      {loadStatus === "error" && <p role="alert">Falha ao carregar suas marcações. Tente novamente.</p>}
      {loadStatus === "ready" && data?.items.length === 0 && (
        <p className={styles.hint}>Nenhuma marcação encontrada com esses filtros.</p>
      )}

      {data && data.items.length > 0 && (
        <>
          <div className={styles.grid}>
            {data.items.map((item) => (
              <BookCard key={item.book.googleBooksId} book={item.book} entry={item} />
            ))}
          </div>
          <div className={styles.pagination}>
            <button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
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

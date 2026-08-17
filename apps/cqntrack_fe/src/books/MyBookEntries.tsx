import {
  BOOK_STATUSES,
  type BookStatus,
  type PaginatedBookEntriesResponse,
} from "@cqntrack/shared";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { usePaginatedEntries } from "../lib/usePaginatedEntries";
import { BookCard } from "./BookCard";
import { BookEntryFilters, type BookEntrySortField } from "./BookEntryFilters";
import styles from "./MyBookEntries.module.css";

// Lida só uma vez, na montagem — valor inicial do filtro quando se chega
// aqui por um link com ?status= (estatística clicável da home, ver
// BookStats); depois vira estado local normal.
function initialStatusFromUrl(searchParams: URLSearchParams): BookStatus | "" {
  const raw = searchParams.get("status");
  return raw !== null && (BOOK_STATUSES as readonly string[]).includes(raw)
    ? (raw as BookStatus)
    : "";
}

export function MyBookEntries() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<BookStatus | "">(() => initialStatusFromUrl(searchParams));
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [sortBy, setSortBy] = useState<BookEntrySortField>("updatedAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  const { data, loadStatus, page, setPage, totalPages } =
    usePaginatedEntries<PaginatedBookEntriesResponse>(
      (page) => {
        const params = new URLSearchParams();
        if (status) params.set("status", status);
        if (favoriteOnly) params.set("favorite", "true");
        params.set("sortBy", sortBy);
        params.set("order", order);
        params.set("page", String(page));
        return `/api/books/entries?${params.toString()}`;
      },
      { status, favoriteOnly, sortBy, order },
    );

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
              <BookCard key={item.book.googleBooksId} book={item.book} entry={item} />
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

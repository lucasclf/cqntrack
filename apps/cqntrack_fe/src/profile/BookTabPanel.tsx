import {
  BOOK_STATUSES,
  BOOK_STATUS_LABELS,
  type BookStatus,
  type PaginatedBookEntriesResponse,
} from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { BookCard } from "../books/BookCard";
import { BookFavoritesSection } from "../books/BookFavoritesSection";
import { apiClient } from "../lib/api-client";
import { RecentlyReadBooks } from "./RecentlyReadBooks";
import styles from "./TabPanel.module.css";

const PAGE_SIZE = 24;

type LoadStatus = "loading" | "ready" | "error";

function parseStatus(raw: string | null): BookStatus | null {
  return raw !== null && (BOOK_STATUSES as readonly string[]).includes(raw)
    ? (raw as BookStatus)
    : null;
}

// Conteúdo da aba "Livros" do perfil público — mesmo padrão de
// MovieTabPanel: sem status mostra favoritos + lido recentemente, com
// status mostra a listagem completa e paginada (destino de BookStats).
export function BookTabPanel() {
  const { handle } = useParams<{ handle: string }>();
  const username = handle?.startsWith("@") ? handle.slice(1) : null;
  const [searchParams] = useSearchParams();
  const status = parseStatus(searchParams.get("status"));

  if (!username) {
    return null;
  }

  if (!status) {
    return (
      <>
        <BookFavoritesSection favoritesEndpoint={`/api/users/${username}/books/favorites`} />
        <RecentlyReadBooks basePath={`/api/users/${username}`} />
      </>
    );
  }

  return <FilteredBooks username={username} status={status} />;
}

interface FilteredBooksProps {
  username: string;
  status: BookStatus;
}

function FilteredBooks({ username, status }: FilteredBooksProps) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PaginatedBookEntriesResponse | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");

  const [trackedStatus, setTrackedStatus] = useState(status);
  if (status !== trackedStatus) {
    setTrackedStatus(status);
    setPage(1);
  }

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ status, page: String(page), pageSize: String(PAGE_SIZE) });

    apiClient
      .get<PaginatedBookEntriesResponse>(`/api/users/${username}/books/entries?${params}`)
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setLoadStatus("ready");
        }
      })
      .catch(() => {
        if (!cancelled) setLoadStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [username, status, page]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div>
      <div className={styles.filterHeader}>
        <h2>{BOOK_STATUS_LABELS[status]}</h2>
        <Link to={`/@${username}/livros`} className={styles.clear}>
          Limpar filtro
        </Link>
      </div>

      {loadStatus === "error" && <p role="alert">Falha ao carregar. Tente novamente.</p>}
      {loadStatus === "ready" && data?.items.length === 0 && (
        <p className={styles.hint}>Nada por aqui ainda.</p>
      )}

      {data && data.items.length > 0 && (
        <>
          <div className={styles.grid}>
            {data.items.map((entry) => (
              <BookCard key={entry.book.googleBooksId} book={entry.book} entry={entry} />
            ))}
          </div>
          {totalPages > 1 && (
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
          )}
        </>
      )}
    </div>
  );
}

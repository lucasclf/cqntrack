import {
  MANGA_STATUSES,
  MANGA_STATUS_LABELS,
  type MangaStatus,
  type PaginatedMangaEntriesResponse,
} from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { MangaCard } from "../manga/MangaCard";
import { MangaFavoritesSection } from "../manga/MangaFavoritesSection";
import { apiClient } from "../lib/api-client";
import { RecentlyReadManga } from "./RecentlyReadManga";
import styles from "./TabPanel.module.css";

const PAGE_SIZE = 24;

type LoadStatus = "loading" | "ready" | "error";

function parseStatus(raw: string | null): MangaStatus | null {
  return raw !== null && (MANGA_STATUSES as readonly string[]).includes(raw)
    ? (raw as MangaStatus)
    : null;
}

// Conteúdo da aba "Mangás" do perfil público — mesmo padrão de
// BookTabPanel: sem status mostra favoritos + lido recentemente, com
// status mostra a listagem completa e paginada (destino de MangaStats).
export function MangaTabPanel() {
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
        <MangaFavoritesSection favoritesEndpoint={`/api/users/${username}/manga/favorites`} />
        <RecentlyReadManga basePath={`/api/users/${username}`} />
      </>
    );
  }

  return <FilteredManga username={username} status={status} />;
}

interface FilteredMangaProps {
  username: string;
  status: MangaStatus;
}

function FilteredManga({ username, status }: FilteredMangaProps) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PaginatedMangaEntriesResponse | null>(null);
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
      .get<PaginatedMangaEntriesResponse>(`/api/users/${username}/manga/entries?${params}`)
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
        <h2>{MANGA_STATUS_LABELS[status]}</h2>
        <Link to={`/@${username}/mangas`} className={styles.clear}>
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
              <MangaCard key={entry.manga.mangadexId} manga={entry.manga} entry={entry} />
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

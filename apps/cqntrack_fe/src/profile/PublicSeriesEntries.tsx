import type { RecentlyWatchedSeriesResponse } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { PublicLayout } from "../layouts/PublicLayout";
import { apiClient } from "../lib/api-client";
import { SeriesCard } from "../series/SeriesCard";
import styles from "./PublicMediaEntries.module.css";

const PAGE_SIZE = 24;

type LoadStatus = "loading" | "ready" | "error";

// Destino da estatística "séries acompanhadas" do perfil público — sem
// filtro de status (série não tem esse campo, ver SeriesStats).
export function PublicSeriesEntries() {
  const { handle } = useParams<{ handle: string }>();
  const username = handle?.startsWith("@") ? handle.slice(1) : null;

  const [page, setPage] = useState(1);
  const [data, setData] = useState<RecentlyWatchedSeriesResponse | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");

  const [trackedUsername, setTrackedUsername] = useState(username);
  if (username !== trackedUsername) {
    setTrackedUsername(username);
    setPage(1);
  }

  useEffect(() => {
    if (!username) return;

    let cancelled = false;

    apiClient
      .get<RecentlyWatchedSeriesResponse>(
        `/api/users/${username}/series/recently-watched?page=${page}&pageSize=${PAGE_SIZE}`,
      )
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
  }, [username, page]);

  if (!username) {
    return (
      <PublicLayout>
        <p>Usuário não encontrado.</p>
      </PublicLayout>
    );
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <PublicLayout>
      <div className={styles.page}>
        <Link to={`/@${username}`} className={styles.back}>
          ← Voltar pro perfil
        </Link>
        <h1>Séries acompanhadas</h1>

        {loadStatus === "error" && <p role="alert">Falha ao carregar. Tente novamente.</p>}
        {loadStatus === "ready" && data?.items.length === 0 && (
          <p className={styles.hint}>Nada por aqui ainda.</p>
        )}

        {data && data.items.length > 0 && (
          <>
            <div className={styles.grid}>
              {data.items.map((item) => (
                <SeriesCard key={item.series.tmdbId} series={item.series} />
              ))}
            </div>
            {totalPages > 1 && (
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
            )}
          </>
        )}
      </div>
    </PublicLayout>
  );
}

import type { RecentlyWatchedSeriesResponse } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { apiClient } from "../lib/api-client";
import { SeriesCard } from "../series/SeriesCard";
import { RecentlyWatchedSeries } from "./RecentlyWatchedSeries";
import { SeriesFavorites } from "./SeriesFavorites";
import styles from "./TabPanel.module.css";

const PAGE_SIZE = 24;

type LoadStatus = "loading" | "ready" | "error";

// Conteúdo da aba "Séries" do perfil público — série não tem status (ver
// SeriesStats), então em vez de ?status= usa ?view=all pra alternar entre
// favoritos+recente e a listagem completa de "séries acompanhadas".
export function SeriesTabPanel() {
  const { handle } = useParams<{ handle: string }>();
  const username = handle?.startsWith("@") ? handle.slice(1) : null;
  const [searchParams] = useSearchParams();
  const showAll = searchParams.get("view") === "all";

  if (!username) {
    return null;
  }

  if (!showAll) {
    return (
      <>
        <SeriesFavorites basePath={`/api/users/${username}`} />
        <RecentlyWatchedSeries basePath={`/api/users/${username}`} />
      </>
    );
  }

  return <AllWatchedSeries username={username} />;
}

function AllWatchedSeries({ username }: { username: string }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<RecentlyWatchedSeriesResponse | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");

  useEffect(() => {
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

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div>
      <div className={styles.filterHeader}>
        <h2>Séries acompanhadas</h2>
        <Link to={`/@${username}/series`} className={styles.clear}>
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
            {data.items.map((item) => (
              <SeriesCard key={item.series.tmdbId} series={item.series} />
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

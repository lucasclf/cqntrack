import type { RecentlyWatchedSeriesResponse } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { apiClient } from "../lib/api-client";
import styles from "./ProfileStats.module.css";

interface SeriesStatsProps {
  username: string;
}

type LoadStatus = "loading" | "ready" | "error";

// Série não tem status (ver RecentlyWatchedSeriesResponse) — em vez de uma
// contagem por status como as outras 3 mídias, mostra só o total de séries
// com pelo menos 1 episódio assistido, clicável pra listagem completa (ver
// PublicSeriesEntries).
export function SeriesStats({ username }: SeriesStatsProps) {
  const [total, setTotal] = useState<number | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");

  useEffect(() => {
    let cancelled = false;

    apiClient
      .get<RecentlyWatchedSeriesResponse>(`/api/users/${username}/series/recently-watched?page=1&pageSize=1`)
      .then((res) => {
        if (!cancelled) {
          setTotal(res.total);
          setLoadStatus("ready");
        }
      })
      .catch(() => {
        if (!cancelled) setLoadStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [username]);

  if (loadStatus !== "ready" || total === null) {
    return null;
  }

  return (
    <div className={styles.card}>
      <h2 className={styles.title}>Estatísticas</h2>
      <ul className={styles.list}>
        <li>
          <Link to={`/@${username}/series`} className={styles.stat}>
            <span>Séries acompanhadas</span>
            <span className={styles.statCount}>{total}</span>
          </Link>
        </li>
      </ul>
    </div>
  );
}

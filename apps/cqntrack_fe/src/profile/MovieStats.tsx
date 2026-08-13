import { MOVIE_STATUSES, MOVIE_STATUS_LABELS, type PaginatedMovieEntriesResponse } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { apiClient } from "../lib/api-client";
import styles from "./ProfileStats.module.css";

interface MovieStatsProps {
  username: string;
}

type LoadStatus = "loading" | "ready" | "error";

// Uma contagem por status (pageSize=1 só pra ler `total`, sem baixar os
// itens) — cada linha é clicável e leva pra listagem completa filtrada
// (ver PublicMovieEntries).
export function MovieStats({ username }: MovieStatsProps) {
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");

  useEffect(() => {
    let cancelled = false;

    Promise.all(
      MOVIE_STATUSES.map((status) =>
        apiClient
          .get<PaginatedMovieEntriesResponse>(`/api/users/${username}/movies/entries?status=${status}&pageSize=1`)
          .then((res) => [status, res.total] as const),
      ),
    )
      .then((entries) => {
        if (cancelled) return;
        setCounts(Object.fromEntries(entries));
        setLoadStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setLoadStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [username]);

  if (loadStatus !== "ready" || !counts) {
    return null;
  }

  return (
    <div className={styles.card}>
      <h2 className={styles.title}>Estatísticas</h2>
      <ul className={styles.list}>
        {MOVIE_STATUSES.map((status) => (
          <li key={status}>
            <Link to={`/@${username}/filmes?status=${status}`} className={styles.stat}>
              <span>{MOVIE_STATUS_LABELS[status]}</span>
              <span className={styles.statCount}>{counts[status]}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

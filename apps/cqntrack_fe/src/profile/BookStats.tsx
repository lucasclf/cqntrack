import { BOOK_STATUSES, BOOK_STATUS_LABELS, type PaginatedBookEntriesResponse } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { apiClient } from "../lib/api-client";
import styles from "./ProfileStats.module.css";

interface BookStatsProps {
  username: string;
}

type LoadStatus = "loading" | "ready" | "error";

// Mesmo padrão de MovieStats — uma contagem por status, clicável pra
// listagem completa filtrada (ver PublicBookEntries).
export function BookStats({ username }: BookStatsProps) {
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");

  useEffect(() => {
    let cancelled = false;

    Promise.all(
      BOOK_STATUSES.map((status) =>
        apiClient
          .get<PaginatedBookEntriesResponse>(`/api/users/${username}/books/entries?status=${status}&pageSize=1`)
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
        {BOOK_STATUSES.map((status) => (
          <li key={status}>
            <Link to={`/@${username}/livros?status=${status}`} className={styles.stat}>
              <span>{BOOK_STATUS_LABELS[status]}</span>
              <span className={styles.statCount}>{counts[status]}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

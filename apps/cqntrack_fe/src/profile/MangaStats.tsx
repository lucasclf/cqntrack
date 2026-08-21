import {
  MANGA_STATUSES,
  MANGA_STATUS_LABELS,
  type PaginatedMangaEntriesResponse,
} from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { apiClient } from "../lib/api-client";
import styles from "./ProfileStats.module.css";

interface MangaStatsProps {
  // "/api/users/:username" (perfil público) ou "/api" (home).
  basePath: string;
  // "/@username/mangas" (perfil público) ou "/mangas/marcacoes" (home).
  linkBase: string;
}

type LoadStatus = "loading" | "ready" | "error";

// Mesmo padrão de BookStats — uma contagem por status, clicável pra
// listagem completa filtrada.
export function MangaStats({ basePath, linkBase }: MangaStatsProps) {
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");

  useEffect(() => {
    let cancelled = false;

    Promise.all(
      MANGA_STATUSES.map((status) =>
        apiClient
          .get<PaginatedMangaEntriesResponse>(
            `${basePath}/manga/entries?status=${status}&pageSize=1`,
          )
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
  }, [basePath]);

  if (loadStatus !== "ready" || !counts) {
    return null;
  }

  return (
    <div className={styles.card}>
      <h2 className={styles.title}>Estatísticas</h2>
      <ul className={styles.list}>
        {MANGA_STATUSES.map((status) => (
          <li key={status}>
            <Link to={`${linkBase}?status=${status}`} className={styles.stat}>
              <span>{MANGA_STATUS_LABELS[status]}</span>
              <span className={styles.statCount}>{counts[status]}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

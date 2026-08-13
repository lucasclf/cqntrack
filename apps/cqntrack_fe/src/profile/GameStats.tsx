import {
  GAME_STATUSES,
  GAME_STATUS_LABELS,
  type PaginatedGameEntriesResponse,
} from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { apiClient } from "../lib/api-client";
import styles from "./ProfileStats.module.css";

interface GameStatsProps {
  // "/api/users/:username" (perfil público) ou "/api" (home).
  basePath: string;
  // "/@username/jogos" (perfil público) ou "/jogos/marcacoes" (home).
  linkBase: string;
}

type LoadStatus = "loading" | "ready" | "error";

// Mesmo padrão de MovieStats — uma contagem por status, clicável pra
// listagem completa filtrada.
export function GameStats({ basePath, linkBase }: GameStatsProps) {
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");

  useEffect(() => {
    let cancelled = false;

    Promise.all(
      GAME_STATUSES.map((status) =>
        apiClient
          .get<PaginatedGameEntriesResponse>(
            `${basePath}/games/entries?status=${status}&pageSize=1`,
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
        {GAME_STATUSES.map((status) => (
          <li key={status}>
            <Link to={`${linkBase}?status=${status}`} className={styles.stat}>
              <span>{GAME_STATUS_LABELS[status]}</span>
              <span className={styles.statCount}>{counts[status]}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

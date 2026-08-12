import type { PaginatedGameEntriesResponse } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { GameCard } from "../games/GameCard";
import { apiClient } from "../lib/api-client";
import styles from "./MixedMediaGrid.module.css";

interface RecentlyPlayedGamesProps {
  username: string;
}

type LoadStatus = "loading" | "ready" | "error";

const RECENT_LIMIT = 12;
// Busca uma página maior que o limite final porque o filtro de "jogado" (com
// status real, não backlog) acontece no cliente — ver comentário abaixo.
const FETCH_PAGE_SIZE = 20;

// A query de entries só filtra por 1 valor de status por vez, e "jogado"
// cobre vários ("playing"/"completed"/"platinum", nunca "not_started") —
// busca as mais recentemente atualizadas e filtra aqui, em vez de mudar o
// filtro genérico de status pra aceitar múltiplos valores.
export function RecentlyPlayedGames({ username }: RecentlyPlayedGamesProps) {
  const [data, setData] = useState<PaginatedGameEntriesResponse | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");

  useEffect(() => {
    let cancelled = false;

    apiClient
      .get<PaginatedGameEntriesResponse>(
        `/api/users/${username}/games/entries?sortBy=updatedAt&order=desc&pageSize=${FETCH_PAGE_SIZE}`,
      )
      .then((response) => {
        if (!cancelled) {
          setData(response);
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

  if (loadStatus !== "ready" || !data) {
    return null;
  }

  const played = data.items
    .filter((entry) => entry.status !== null && entry.status !== "not_started")
    .slice(0, RECENT_LIMIT);
  if (played.length === 0) {
    return null;
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2>Jogado recentemente</h2>
        <span className={styles.count}>{played.length}</span>
      </div>
      <div className={styles.grid}>
        {played.map((entry) => (
          <GameCard key={entry.game.igdbId} game={entry.game} entry={entry} />
        ))}
      </div>
    </section>
  );
}

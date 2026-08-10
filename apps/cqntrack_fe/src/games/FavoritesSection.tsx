import type { GameEntryWithGame, PaginatedGameEntriesResponse } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { gamesClient } from "../lib/games-client";
import { GameCard } from "./GameCard";
import styles from "./FavoritesSection.module.css";

interface FavoritesSectionProps {
  // "/api/games/entries" (próprio usuário) ou "/api/users/:username/entries"
  // (perfil público) — mesmo formato de resposta nos dois casos.
  entriesEndpoint: string;
}

type LoadStatus = "loading" | "ready" | "error";

// Favoritos são limitados a 4 por usuário (MAX_FAVORITE_GAMES no backend) —
// cabem numa fileira só, sem paginação. Seção discreta: se falhar ou não
// houver nenhum favorito, some sem atrapalhar o resto da página.
export function FavoritesSection({ entriesEndpoint }: FavoritesSectionProps) {
  const [items, setItems] = useState<GameEntryWithGame[]>([]);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");

  useEffect(() => {
    let cancelled = false;

    gamesClient
      .get<PaginatedGameEntriesResponse>(`${entriesEndpoint}?favorite=true&pageSize=4`)
      .then((data) => {
        if (!cancelled) {
          setItems(data.items);
          setLoadStatus("ready");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadStatus("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [entriesEndpoint]);

  if (loadStatus !== "ready" || items.length === 0) {
    return null;
  }

  return (
    <section className={styles.section}>
      <h2>Favoritos</h2>
      <div className={styles.grid}>
        {items.map((item) => (
          <GameCard key={item.game.igdbId} game={item.game} entry={item} />
        ))}
      </div>
    </section>
  );
}

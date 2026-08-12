import type { FavoritesResponse } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { apiClient } from "../lib/api-client";
import { GameCard } from "./GameCard";
import styles from "./FavoritesSection.module.css";

interface FavoritesSectionProps {
  // "/api/users/:username/games/favorites" — leitura pública, sem interação
  // (favoritar só acontece na própria tela de detalhe do jogo, logado).
  favoritesEndpoint: string;
}

type LoadStatus = "loading" | "ready" | "error";

export function FavoritesSection({ favoritesEndpoint }: FavoritesSectionProps) {
  const [data, setData] = useState<FavoritesResponse | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");

  useEffect(() => {
    let cancelled = false;

    apiClient
      .get<FavoritesResponse>(favoritesEndpoint)
      .then((res) => {
        if (!cancelled) {
          setData(res);
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
  }, [favoritesEndpoint]);

  if (loadStatus !== "ready" || !data) {
    return null;
  }

  if (data.items.length === 0) {
    return null;
  }

  return (
    <section className={styles.section}>
      <h2>Jogos favoritos</h2>
      <div className={styles.grid}>
        {data.items.map((entry) => (
          <GameCard key={entry.game.igdbId} game={entry.game} entry={entry} />
        ))}
      </div>
    </section>
  );
}

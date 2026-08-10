import type { FavoritesResponse } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { gamesClient } from "../lib/games-client";
import { GameCard } from "./GameCard";
import styles from "./FavoritesSection.module.css";

interface FavoritesSectionProps {
  // "/api/users/:username/favorites" — leitura pública, sem interação (a
  // edição dos slots só existe na própria home, via FavoriteSlots).
  favoritesEndpoint: string;
}

type LoadStatus = "loading" | "ready" | "error";

// Só mostra os slots preenchidos — diferente de FavoriteSlots (home,
// interativo), aqui não faz sentido mostrar slot vazio pro visitante.
export function FavoritesSection({ favoritesEndpoint }: FavoritesSectionProps) {
  const [data, setData] = useState<FavoritesResponse | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");

  useEffect(() => {
    let cancelled = false;

    gamesClient
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

  const filled = data.slots.filter((slot) => slot.entry !== null);
  if (filled.length === 0) {
    return null;
  }

  return (
    <section className={styles.section}>
      <h2>Favoritos</h2>
      <div className={styles.grid}>
        {filled.map(({ slot, entry }) => (
          <GameCard key={slot} game={entry!.game} entry={entry!} />
        ))}
      </div>
    </section>
  );
}

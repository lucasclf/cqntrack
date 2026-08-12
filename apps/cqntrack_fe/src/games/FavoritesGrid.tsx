import type { FavoritesResponse } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { apiClient } from "../lib/api-client";
import styles from "./FavoritesGrid.module.css";
import { GameCard } from "./GameCard";

type LoadStatus = "loading" | "ready" | "error";

// Grade sem limite de quantidade, ordenada por favoritedAt (mais recente
// primeiro, já vem assim do backend) — favoritar/desfavoritar acontece na
// própria tela de detalhe do jogo (botão de coração), não mais aqui.
export function FavoritesGrid() {
  const [data, setData] = useState<FavoritesResponse | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");

  useEffect(() => {
    let cancelled = false;

    apiClient
      .get<FavoritesResponse>("/api/games/favorites")
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
  }, []);

  if (loadStatus === "loading") {
    return <p>Carregando favoritos...</p>;
  }
  if (loadStatus === "error" || !data) {
    return <p role="alert">Falha ao carregar seus favoritos. Tente novamente.</p>;
  }
  if (data.items.length === 0) {
    return <p className={styles.hint}>Nenhum jogo favoritado ainda.</p>;
  }

  return (
    <div className={styles.grid}>
      {data.items.map((entry) => (
        <GameCard key={entry.game.igdbId} game={entry.game} entry={entry} />
      ))}
    </div>
  );
}

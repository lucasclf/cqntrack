import type { SeriesFavoritesResponse } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { apiClient } from "../lib/api-client";
import { SeriesCard } from "./SeriesCard";
import styles from "./SeriesFavoritesGrid.module.css";

type LoadStatus = "loading" | "ready" | "error";

// Grade sem limite de quantidade, ordenada por favoritedAt (mais recente
// primeiro, já vem assim do backend) — favoritar/desfavoritar acontece na
// própria tela de detalhe da série (botão de coração), não mais aqui.
export function SeriesFavoritesGrid() {
  const [data, setData] = useState<SeriesFavoritesResponse | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");

  useEffect(() => {
    let cancelled = false;

    apiClient
      .get<SeriesFavoritesResponse>("/api/series/favorites")
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
    return <p className={styles.hint}>Nenhuma série favoritada ainda.</p>;
  }

  return (
    <div className={styles.grid}>
      {data.items.map((entry) => (
        <SeriesCard key={entry.series.tmdbId} series={entry.series} entry={entry} />
      ))}
    </div>
  );
}

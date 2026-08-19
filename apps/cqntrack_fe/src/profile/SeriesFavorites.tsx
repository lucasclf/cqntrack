import type { SeriesFavoritesResponse } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { apiClient } from "../lib/api-client";
import { SeriesCard } from "../series/SeriesCard";
import styles from "./MixedMediaGrid.module.css";

interface SeriesFavoritesProps {
  // "/api/users/:username" (perfil público) ou "/api" (home, dados
  // próprios) — mesmo componente serve os dois, só troca o prefixo.
  basePath: string;
  // Mostrada quando a lista vem vazia — omitido (perfil público, ver
  // SeriesTabPanel) continua sumindo em silêncio, como sempre foi.
  emptyMessage?: string;
}

type LoadStatus = "loading" | "ready" | "error";

export function SeriesFavorites({ basePath, emptyMessage }: SeriesFavoritesProps) {
  const [data, setData] = useState<SeriesFavoritesResponse | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");

  useEffect(() => {
    let cancelled = false;

    apiClient
      .get<SeriesFavoritesResponse>(`${basePath}/series/favorites`)
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setLoadStatus("ready");
        }
      })
      .catch(() => {
        if (!cancelled) setLoadStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [basePath]);

  if (loadStatus !== "ready" || !data) {
    return null;
  }

  if (data.items.length === 0) {
    return emptyMessage ? <p className={styles.hint}>{emptyMessage}</p> : null;
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2>Séries favoritas</h2>
        <span className={styles.count}>{data.items.length}</span>
      </div>
      <div className={styles.grid}>
        {data.items.map((entry) => (
          <SeriesCard key={entry.series.tmdbId} series={entry.series} entry={entry} />
        ))}
      </div>
    </section>
  );
}

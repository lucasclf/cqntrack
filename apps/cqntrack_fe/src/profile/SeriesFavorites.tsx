import type { SeriesFavoritesResponse } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { apiClient } from "../lib/api-client";
import { SeriesCard } from "../series/SeriesCard";
import styles from "./MixedMediaGrid.module.css";

interface SeriesFavoritesProps {
  username: string;
}

type LoadStatus = "loading" | "ready" | "error";

export function SeriesFavorites({ username }: SeriesFavoritesProps) {
  const [data, setData] = useState<SeriesFavoritesResponse | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");

  useEffect(() => {
    let cancelled = false;

    apiClient
      .get<SeriesFavoritesResponse>(`/api/users/${username}/series/favorites`)
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
  }, [username]);

  if (loadStatus !== "ready" || !data || data.items.length === 0) {
    return null;
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

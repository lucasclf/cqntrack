import type { RecentlyWatchedSeriesResponse } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { apiClient } from "../lib/api-client";
import { SeriesCard } from "../series/SeriesCard";
import styles from "./MixedMediaGrid.module.css";

interface RecentlyWatchedSeriesProps {
  username: string;
}

type LoadStatus = "loading" | "ready" | "error";

const RECENT_LIMIT = 12;

export function RecentlyWatchedSeries({ username }: RecentlyWatchedSeriesProps) {
  const [data, setData] = useState<RecentlyWatchedSeriesResponse | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");

  useEffect(() => {
    let cancelled = false;

    apiClient
      .get<RecentlyWatchedSeriesResponse>(`/api/users/${username}/series/recently-watched?limit=${RECENT_LIMIT}`)
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
        <h2>Assistido recentemente</h2>
        <span className={styles.count}>{data.items.length}</span>
      </div>
      <div className={styles.grid}>
        {data.items.map((item) => (
          <SeriesCard key={item.series.tmdbId} series={item.series} />
        ))}
      </div>
    </section>
  );
}

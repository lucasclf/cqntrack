import type { PaginatedMovieEntriesResponse } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { apiClient } from "../lib/api-client";
import { MovieCard } from "../movies/MovieCard";
import styles from "./MixedMediaGrid.module.css";

interface RecentlyWatchedMoviesProps {
  username: string;
}

type LoadStatus = "loading" | "ready" | "error";

const RECENT_LIMIT = 12;

export function RecentlyWatchedMovies({ username }: RecentlyWatchedMoviesProps) {
  const [data, setData] = useState<PaginatedMovieEntriesResponse | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");

  useEffect(() => {
    let cancelled = false;

    apiClient
      .get<PaginatedMovieEntriesResponse>(
        `/api/users/${username}/movies/entries?status=watched&sortBy=updatedAt&order=desc&pageSize=${RECENT_LIMIT}`,
      )
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
        {data.items.map((entry) => (
          <MovieCard key={entry.movie.tmdbId} movie={entry.movie} entry={entry} />
        ))}
      </div>
    </section>
  );
}

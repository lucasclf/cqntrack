import type {
  PaginatedMovieEntriesResponse,
  RecentlyWatchedSeriesResponse,
} from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { apiClient } from "../lib/api-client";
import { MovieCard } from "../movies/MovieCard";
import { SeriesCard } from "../series/SeriesCard";
import styles from "./MixedMediaGrid.module.css";

interface RecentlyWatchedMoviesAndSeriesProps {
  username: string;
}

type Item =
  | { mediaType: "movies"; watchedAt: string; entry: PaginatedMovieEntriesResponse["items"][number] }
  | { mediaType: "series"; watchedAt: string; entry: RecentlyWatchedSeriesResponse["items"][number] };

type LoadStatus = "loading" | "ready" | "error";

const RECENT_LIMIT = 12;

// Filme usa o próprio status "watched" (entries?status=watched); série não
// tem status (ver RecentlyWatchedSeriesResponse) — usa o episódio assistido
// mais recentemente como sinal. Junta os dois numa grade só, ordenada por
// data decrescente.
export function RecentlyWatchedMoviesAndSeries({ username }: RecentlyWatchedMoviesAndSeriesProps) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      apiClient.get<PaginatedMovieEntriesResponse>(
        `/api/users/${username}/movies/entries?status=watched&sortBy=updatedAt&order=desc&pageSize=${RECENT_LIMIT}`,
      ),
      apiClient.get<RecentlyWatchedSeriesResponse>(
        `/api/users/${username}/series/recently-watched?limit=${RECENT_LIMIT}`,
      ),
    ])
      .then(([movies, series]) => {
        if (cancelled) return;
        const merged: Item[] = [
          ...movies.items.map((entry): Item => ({
            mediaType: "movies",
            watchedAt: entry.watchedAt ?? entry.updatedAt,
            entry,
          })),
          ...series.items.map((entry): Item => ({
            mediaType: "series",
            watchedAt: entry.lastWatchedAt,
            entry,
          })),
        ]
          .sort((a, b) => b.watchedAt.localeCompare(a.watchedAt))
          .slice(0, RECENT_LIMIT);
        setItems(merged);
        setLoadStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setLoadStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [username]);

  if (loadStatus !== "ready" || !items || items.length === 0) {
    return null;
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2>Assistido recentemente</h2>
        <span className={styles.count}>{items.length}</span>
      </div>
      <div className={styles.grid}>
        {items.map((item) =>
          item.mediaType === "movies" ? (
            <MovieCard key={`movie-${item.entry.movie.tmdbId}`} movie={item.entry.movie} entry={item.entry} />
          ) : (
            <SeriesCard key={`series-${item.entry.series.tmdbId}`} series={item.entry.series} />
          ),
        )}
      </div>
    </section>
  );
}

import type { PaginatedMovieEntriesResponse } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { apiClient } from "../lib/api-client";
import { MovieCard } from "../movies/MovieCard";
import styles from "./MixedMediaGrid.module.css";

interface RecentlyWatchedMoviesProps {
  // "/api/users/:username" (perfil público) ou "/api" (home, dados
  // próprios) — mesmo componente serve os dois, só troca o prefixo.
  basePath: string;
  // Mostrada quando a lista vem vazia — omitido (perfil público, ver
  // MovieTabPanel) continua sumindo em silêncio, como sempre foi.
  emptyMessage?: string;
}

type LoadStatus = "loading" | "ready" | "error";

const RECENT_LIMIT = 12;

export function RecentlyWatchedMovies({ basePath, emptyMessage }: RecentlyWatchedMoviesProps) {
  const [data, setData] = useState<PaginatedMovieEntriesResponse | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");

  useEffect(() => {
    let cancelled = false;

    apiClient
      .get<PaginatedMovieEntriesResponse>(
        `${basePath}/movies/entries?status=watched&sortBy=updatedAt&order=desc&pageSize=${RECENT_LIMIT}`,
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

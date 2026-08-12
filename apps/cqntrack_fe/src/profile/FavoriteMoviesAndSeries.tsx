import type { MovieFavoritesResponse, SeriesFavoritesResponse } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { apiClient } from "../lib/api-client";
import { MovieCard } from "../movies/MovieCard";
import { SeriesCard } from "../series/SeriesCard";
import styles from "./MixedMediaGrid.module.css";

interface FavoriteMoviesAndSeriesProps {
  username: string;
}

type Item =
  | { mediaType: "movies"; favoritedAt: string; entry: MovieFavoritesResponse["items"][number] }
  | { mediaType: "series"; favoritedAt: string; entry: SeriesFavoritesResponse["items"][number] };

type LoadStatus = "loading" | "ready" | "error";

// Junta os favoritos de filme e série numa grade só (os dois são
// "assistíveis"), ordenados por favoritedAt decrescente misturados — mesmo
// espírito de PersonCreditItem já misturar mediaType "movies"/"series".
export function FavoriteMoviesAndSeries({ username }: FavoriteMoviesAndSeriesProps) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      apiClient.get<MovieFavoritesResponse>(`/api/users/${username}/movies/favorites`),
      apiClient.get<SeriesFavoritesResponse>(`/api/users/${username}/series/favorites`),
    ])
      .then(([movies, series]) => {
        if (cancelled) return;
        const merged: Item[] = [
          ...movies.items.map((entry): Item => ({
            mediaType: "movies",
            favoritedAt: entry.favoritedAt!,
            entry,
          })),
          ...series.items.map((entry): Item => ({
            mediaType: "series",
            favoritedAt: entry.favoritedAt!,
            entry,
          })),
        ].sort((a, b) => b.favoritedAt.localeCompare(a.favoritedAt));
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
    <section>
      <h2>Filmes e séries favoritos</h2>
      <div className={styles.grid}>
        {items.map((item) =>
          item.mediaType === "movies" ? (
            <MovieCard key={`movie-${item.entry.movie.tmdbId}`} movie={item.entry.movie} entry={item.entry} />
          ) : (
            <SeriesCard key={`series-${item.entry.series.tmdbId}`} series={item.entry.series} entry={item.entry} />
          ),
        )}
      </div>
    </section>
  );
}

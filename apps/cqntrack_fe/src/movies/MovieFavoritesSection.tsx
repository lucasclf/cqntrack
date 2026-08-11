import type { MovieFavoritesResponse } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { apiClient } from "../lib/api-client";
import { MovieCard } from "./MovieCard";
import styles from "./MovieFavoritesSection.module.css";

interface MovieFavoritesSectionProps {
  // "/api/users/:username/movies/favorites" — leitura pública, sem interação
  // (a edição dos slots só existe na própria home, via MovieFavoriteSlots).
  favoritesEndpoint: string;
}

type LoadStatus = "loading" | "ready" | "error";

// Só mostra os slots preenchidos — diferente de MovieFavoriteSlots (home,
// interativo), aqui não faz sentido mostrar slot vazio pro visitante.
export function MovieFavoritesSection({ favoritesEndpoint }: MovieFavoritesSectionProps) {
  const [data, setData] = useState<MovieFavoritesResponse | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");

  useEffect(() => {
    let cancelled = false;

    apiClient
      .get<MovieFavoritesResponse>(favoritesEndpoint)
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
      <h2>Filmes favoritos</h2>
      <div className={styles.grid}>
        {filled.map(({ slot, entry }) => (
          <MovieCard key={slot} movie={entry!.movie} entry={entry!} />
        ))}
      </div>
    </section>
  );
}

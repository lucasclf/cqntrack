import type { SeriesFavoritesResponse } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { apiClient } from "../lib/api-client";
import { SeriesCard } from "./SeriesCard";
import styles from "./SeriesFavoritesSection.module.css";

interface SeriesFavoritesSectionProps {
  // "/api/users/:username/series/favorites" — leitura pública, sem interação
  // (a edição dos slots só existe na própria home, via SeriesFavoriteSlots).
  favoritesEndpoint: string;
}

type LoadStatus = "loading" | "ready" | "error";

// Só mostra os slots preenchidos — diferente de SeriesFavoriteSlots (home,
// interativo), aqui não faz sentido mostrar slot vazio pro visitante.
export function SeriesFavoritesSection({ favoritesEndpoint }: SeriesFavoritesSectionProps) {
  const [data, setData] = useState<SeriesFavoritesResponse | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");

  useEffect(() => {
    let cancelled = false;

    apiClient
      .get<SeriesFavoritesResponse>(favoritesEndpoint)
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
      <h2>Séries favoritas</h2>
      <div className={styles.grid}>
        {filled.map(({ slot, entry }) => (
          <SeriesCard key={slot} series={entry!.series} entry={entry!} />
        ))}
      </div>
    </section>
  );
}

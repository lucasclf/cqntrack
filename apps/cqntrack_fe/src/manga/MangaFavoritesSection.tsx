import type { MangaFavoritesResponse } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { apiClient } from "../lib/api-client";
import { MangaCard } from "./MangaCard";
import styles from "./MangaFavoritesSection.module.css";

interface MangaFavoritesSectionProps {
  // "/api/users/:username/manga/favorites" — leitura pública, sem interação
  // (favoritar só acontece na própria tela de detalhe do mangá, logado).
  favoritesEndpoint: string;
  // Mostrada quando a lista vem vazia — omitido (perfil público, ver
  // MangaTabPanel) continua sumindo em silêncio, como sempre foi.
  emptyMessage?: string;
}

type LoadStatus = "loading" | "ready" | "error";

export function MangaFavoritesSection({
  favoritesEndpoint,
  emptyMessage,
}: MangaFavoritesSectionProps) {
  const [data, setData] = useState<MangaFavoritesResponse | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");

  useEffect(() => {
    let cancelled = false;

    apiClient
      .get<MangaFavoritesResponse>(favoritesEndpoint)
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

  if (data.items.length === 0) {
    return emptyMessage ? <p className={styles.hint}>{emptyMessage}</p> : null;
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2>Mangás favoritos</h2>
        <span className={styles.count}>{data.items.length}</span>
      </div>
      <div className={styles.grid}>
        {data.items.map((entry) => (
          <MangaCard key={entry.manga.mangadexId} manga={entry.manga} entry={entry} />
        ))}
      </div>
    </section>
  );
}

import type { PaginatedMangaEntriesResponse } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { MangaCard } from "../manga/MangaCard";
import { apiClient } from "../lib/api-client";
import styles from "./MixedMediaGrid.module.css";

interface RecentlyReadMangaProps {
  // "/api/users/:username" (perfil público) ou "/api" (home, dados
  // próprios) — mesmo componente serve os dois, só troca o prefixo.
  basePath: string;
  // Mostrada quando a lista vem vazia — omitido (perfil público, ver
  // MangaTabPanel) continua sumindo em silêncio, como sempre foi.
  emptyMessage?: string;
}

type LoadStatus = "loading" | "ready" | "error";

const RECENT_LIMIT = 12;

export function RecentlyReadManga({ basePath, emptyMessage }: RecentlyReadMangaProps) {
  const [data, setData] = useState<PaginatedMangaEntriesResponse | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");

  useEffect(() => {
    let cancelled = false;

    apiClient
      .get<PaginatedMangaEntriesResponse>(
        `${basePath}/manga/entries?status=read&sortBy=updatedAt&order=desc&pageSize=${RECENT_LIMIT}`,
      )
      .then((response) => {
        if (!cancelled) {
          setData(response);
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
        <h2>Lido recentemente</h2>
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

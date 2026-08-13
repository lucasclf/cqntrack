import type { PaginatedBookEntriesResponse } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { BookCard } from "../books/BookCard";
import { apiClient } from "../lib/api-client";
import styles from "./MixedMediaGrid.module.css";

interface RecentlyReadBooksProps {
  // "/api/users/:username" (perfil público) ou "/api" (home, dados
  // próprios) — mesmo componente serve os dois, só troca o prefixo.
  basePath: string;
}

type LoadStatus = "loading" | "ready" | "error";

const RECENT_LIMIT = 12;

export function RecentlyReadBooks({ basePath }: RecentlyReadBooksProps) {
  const [data, setData] = useState<PaginatedBookEntriesResponse | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");

  useEffect(() => {
    let cancelled = false;

    apiClient
      .get<PaginatedBookEntriesResponse>(
        `${basePath}/books/entries?status=read&sortBy=updatedAt&order=desc&pageSize=${RECENT_LIMIT}`,
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

  if (loadStatus !== "ready" || !data || data.items.length === 0) {
    return null;
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2>Lido recentemente</h2>
        <span className={styles.count}>{data.items.length}</span>
      </div>
      <div className={styles.grid}>
        {data.items.map((entry) => (
          <BookCard key={entry.book.googleBooksId} book={entry.book} entry={entry} />
        ))}
      </div>
    </section>
  );
}

import type { BookFavoritesResponse } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { apiClient } from "../lib/api-client";
import { BookCard } from "./BookCard";
import styles from "./BookFavoritesSection.module.css";

interface BookFavoritesSectionProps {
  // "/api/users/:username/books/favorites" — leitura pública, sem interação
  // (favoritar só acontece na própria tela de detalhe do livro, logado).
  favoritesEndpoint: string;
}

type LoadStatus = "loading" | "ready" | "error";

export function BookFavoritesSection({ favoritesEndpoint }: BookFavoritesSectionProps) {
  const [data, setData] = useState<BookFavoritesResponse | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");

  useEffect(() => {
    let cancelled = false;

    apiClient
      .get<BookFavoritesResponse>(favoritesEndpoint)
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
    return null;
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2>Livros favoritos</h2>
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

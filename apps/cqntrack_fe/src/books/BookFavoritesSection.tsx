import type { BookFavoritesResponse } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { apiClient } from "../lib/api-client";
import { BookCard } from "./BookCard";
import styles from "./BookFavoritesSection.module.css";

interface BookFavoritesSectionProps {
  // "/api/users/:username/books/favorites" — leitura pública, sem interação
  // (a edição dos slots só existe na própria home, via BookFavoriteSlots).
  favoritesEndpoint: string;
}

type LoadStatus = "loading" | "ready" | "error";

// Só mostra os slots preenchidos — diferente de BookFavoriteSlots (home,
// interativo), aqui não faz sentido mostrar slot vazio pro visitante.
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

  const filled = data.slots.filter((slot) => slot.entry !== null);
  if (filled.length === 0) {
    return null;
  }

  return (
    <section className={styles.section}>
      <h2>Livros favoritos</h2>
      <div className={styles.grid}>
        {filled.map(({ slot, entry }) => (
          <BookCard key={slot} book={entry!.book} entry={entry!} />
        ))}
      </div>
    </section>
  );
}

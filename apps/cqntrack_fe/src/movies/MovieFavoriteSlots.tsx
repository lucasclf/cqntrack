import type { FavoriteSlotNumber, MovieEntry, MovieFavoritesResponse, MovieSummary } from "@cqntrack/shared";
import type { SVGProps } from "react";
import { useEffect, useState } from "react";
import { apiClient } from "../lib/api-client";
import { MovieCard } from "./MovieCard";
import styles from "./MovieFavoriteSlots.module.css";
import { MovieFavoritePickerModal } from "./MovieFavoritePickerModal";

type LoadStatus = "loading" | "ready" | "error";

function EditIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

// 4 slots fixos de favorito, sempre visíveis — vazio mostra um "+" clicável
// pra abrir o popup de busca; preenchido mostra o filme, com um lápis que
// aparece no hover pra trocar o favorito daquele slot. Espelha
// SeriesFavoriteSlots.
export function MovieFavoriteSlots() {
  const [data, setData] = useState<MovieFavoritesResponse | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [editingSlot, setEditingSlot] = useState<FavoriteSlotNumber | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    apiClient
      .get<MovieFavoritesResponse>("/api/movies/favorites")
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
  }, []);

  async function handleSelect(movie: MovieSummary) {
    if (editingSlot === null) return;
    const slot = editingSlot;
    setSaveError(null);
    try {
      const entry = await apiClient.put<MovieEntry>(`/api/movies/favorites/${slot}`, {
        tmdbId: movie.tmdbId,
      });
      setData((current) =>
        current
          ? {
              slots: current.slots.map((current_) => {
                if (current_.slot === slot) {
                  return { slot, entry: { ...entry, movie } };
                }
                // Se o filme já estava em outro slot, o backend já limpou de
                // lá — reflete isso aqui também.
                if (current_.entry?.movie.tmdbId === movie.tmdbId) {
                  return { slot: current_.slot, entry: null };
                }
                return current_;
              }),
            }
          : current,
      );
      setEditingSlot(null);
    } catch {
      setSaveError("Falha ao definir o favorito. Tente novamente.");
    }
  }

  if (loadStatus === "loading") {
    return <p>Carregando favoritos...</p>;
  }
  if (loadStatus === "error" || !data) {
    return <p role="alert">Falha ao carregar seus favoritos. Tente novamente.</p>;
  }

  return (
    <section className={styles.section}>
      {saveError && <p role="alert">{saveError}</p>}
      <div className={styles.grid}>
        {data.slots.map(({ slot, entry }) =>
          entry ? (
            <div key={slot} className={styles.slotWrap}>
              <MovieCard movie={entry.movie} entry={entry} />
              <button
                type="button"
                className={styles.editBtn}
                aria-label={`Trocar favorito ${slot}`}
                onClick={() => setEditingSlot(slot)}
              >
                <EditIcon />
              </button>
            </div>
          ) : (
            <button
              key={slot}
              type="button"
              className={styles.emptySlot}
              aria-label={`Adicionar favorito ${slot}`}
              onClick={() => setEditingSlot(slot)}
            >
              +
            </button>
          ),
        )}
      </div>
      {editingSlot !== null && (
        <MovieFavoritePickerModal onSelect={handleSelect} onClose={() => setEditingSlot(null)} />
      )}
    </section>
  );
}

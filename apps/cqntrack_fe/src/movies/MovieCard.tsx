import {
  MOVIE_STATUS_LABELS,
  type MovieEntry,
  type MovieStatus,
  type MovieSummary,
} from "@cqntrack/shared";
import { useState, type MouseEvent } from "react";
import { Link } from "react-router";
import { apiClient } from "../lib/api-client";
import styles from "./MovieCard.module.css";

interface MovieCardProps {
  movie: MovieSummary;
  // Presente nas telas que já sabem a marcação do usuário pro filme
  // (marcações, listas, busca, descobrir, perfil) — null quando o filme
  // nunca foi marcado, undefined nas raras telas que ainda não carregam
  // entry nenhuma.
  entry?: MovieEntry | null;
  // Ações rápidas (favoritar/marcar assistido) só aparecem quando true —
  // nunca no perfil público de outra pessoa (apps/cqntrack_fe/src/profile/*
  // usa o Card sem essa prop de propósito: lá a entry é de quem é dono do
  // perfil, não de quem está vendo — clicar não pode mexer no dado de
  // outra conta).
  interactive?: boolean;
}

const WATCHED_STATUS: MovieStatus = "watched";

function withPatch(current: MovieEntry | null, patch: Partial<MovieEntry>): MovieEntry {
  return {
    id: current?.id ?? "",
    status: current?.status ?? null,
    rating: current?.rating ?? null,
    watchedAt: current?.watchedAt ?? null,
    favoritedAt: current?.favoritedAt ?? null,
    review: current?.review ?? null,
    updatedAt: current?.updatedAt ?? new Date().toISOString(),
    ...patch,
  };
}

// Cartão de filme reutilizado em busca, listas, marcações e perfil público —
// sempre linka pro detalhe do filme (/filmes/:tmdbId). Card inteiro é um
// <Link>, então os botões de ação rápida precisam de preventDefault +
// stopPropagation pra não disparar a navegação junto do clique.
export function MovieCard({ movie, entry, interactive = false }: MovieCardProps) {
  const year = movie.releaseDate ? movie.releaseDate.slice(0, 4) : null;
  const extraGenres = movie.genres.length - 1;

  // Estado local otimista pras ações rápidas — reverte se o PUT falhar.
  // Ressincroniza quando a prop `entry` muda de verdade (ex.: grid
  // recarregado do zero), mesmo padrão "trackedX" já usado em
  // SeriesEpisodeList/MangaVolumeList.
  const [localEntry, setLocalEntry] = useState(entry ?? null);
  const [trackedEntry, setTrackedEntry] = useState(entry);
  if (entry !== trackedEntry) {
    setTrackedEntry(entry);
    setLocalEntry(entry ?? null);
  }

  async function toggleFavorite(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    const wasFavorited = localEntry?.favoritedAt != null;
    const previous = localEntry;
    setLocalEntry(
      withPatch(localEntry, { favoritedAt: wasFavorited ? null : new Date().toISOString() }),
    );
    try {
      const updated = await apiClient.put<MovieEntry>(`/api/movies/${movie.tmdbId}/entry`, {
        favorited: !wasFavorited,
      });
      setLocalEntry(updated);
    } catch {
      setLocalEntry(previous);
    }
  }

  async function toggleWatched(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    const wasWatched = localEntry?.status === WATCHED_STATUS;
    const nextStatus = wasWatched ? null : WATCHED_STATUS;
    const previous = localEntry;
    setLocalEntry(withPatch(localEntry, { status: nextStatus }));
    try {
      const updated = await apiClient.put<MovieEntry>(`/api/movies/${movie.tmdbId}/entry`, {
        status: nextStatus,
      });
      setLocalEntry(updated);
    } catch {
      setLocalEntry(previous);
    }
  }

  const favorited = localEntry?.favoritedAt != null;
  const watched = localEntry?.status === WATCHED_STATUS;

  return (
    <Link to={`/filmes/${movie.tmdbId}`} className={styles.card}>
      <div className={styles.coverWrap}>
        {movie.posterUrl ? (
          <img className={styles.cover} src={movie.posterUrl} alt="" loading="lazy" />
        ) : (
          <div className={styles.coverPlaceholder} aria-hidden="true" />
        )}
        {movie.rating !== null && (
          <span className={styles.ratingBadge}>{movie.rating.toFixed(1)}</span>
        )}
        {interactive ? (
          <button
            type="button"
            className={styles.favoriteButton}
            aria-pressed={favorited}
            aria-label={favorited ? "Desfavoritar" : "Favoritar"}
            onClick={toggleFavorite}
          >
            {favorited ? "♥" : "♡"}
          </button>
        ) : (
          favorited && (
            <span className={styles.favoriteBadge} aria-label="Favoritado">
              ♥
            </span>
          )
        )}
        {interactive && (
          <button
            type="button"
            className={styles.completeButton}
            aria-pressed={watched}
            aria-label={watched ? "Desmarcar como assistido" : "Marcar como assistido"}
            onClick={toggleWatched}
          >
            ✓
          </button>
        )}
      </div>
      <div className={styles.info}>
        <p className={styles.name}>{movie.name}</p>
        <p className={styles.meta}>
          {year ?? "Data desconhecida"}
          {movie.genres.length > 0 &&
            ` · ${movie.genres[0]}${extraGenres > 0 ? ` +${extraGenres}` : ""}`}
        </p>
        {/* Sempre reserva a linha quando há entry, com status/nota ou vazia
            — senão os cards sem nenhum dos dois ficam mais baixos que os
            vizinhos que têm, quebrando o alinhamento da fileira no grid. */}
        {localEntry && (
          <p className={styles.entryMeta}>
            {localEntry.status && (
              <span className={styles.statusPill}>{MOVIE_STATUS_LABELS[localEntry.status]}</span>
            )}
            {localEntry.rating !== null && (
              <span className={styles.personalRating}>★ {localEntry.rating.toFixed(1)}</span>
            )}
          </p>
        )}
      </div>
    </Link>
  );
}

import {
  GAME_STATUS_LABELS,
  type GameEntry,
  type GameStatus,
  type GameSummary,
} from "@cqntrack/shared";
import { useState, type MouseEvent } from "react";
import { Link } from "react-router";
import { apiClient } from "../lib/api-client";
import styles from "./GameCard.module.css";

interface GameCardProps {
  game: GameSummary;
  // Presente nas telas que já sabem a marcação do usuário pro jogo
  // (marcações, listas, busca, descobrir, perfil) — null quando o jogo
  // nunca foi marcado, undefined nas raras telas que ainda não carregam
  // entry nenhuma.
  entry?: GameEntry | null;
  // Ações rápidas (favoritar/marcar concluído) só aparecem quando true —
  // nunca no perfil público de outra pessoa (apps/cqntrack_fe/src/profile/*
  // usa o Card sem essa prop de propósito: lá a entry é de quem é dono do
  // perfil, não de quem está vendo — clicar não pode mexer no dado de
  // outra conta).
  interactive?: boolean;
}

const COMPLETED_STATUS: GameStatus = "completed";

function withPatch(current: GameEntry | null, patch: Partial<GameEntry>): GameEntry {
  return {
    id: current?.id ?? "",
    status: current?.status ?? null,
    rating: current?.rating ?? null,
    favoritedAt: current?.favoritedAt ?? null,
    platforms: current?.platforms ?? null,
    review: current?.review ?? null,
    updatedAt: current?.updatedAt ?? new Date().toISOString(),
    ...patch,
  };
}

// Cartão de jogo reutilizado em busca, listas, marcações e perfil público —
// sempre linka pro detalhe do jogo (/jogos/:igdbId). Card inteiro é um
// <Link>, então os botões de ação rápida precisam de preventDefault +
// stopPropagation pra não disparar a navegação junto do clique.
export function GameCard({ game, entry, interactive = false }: GameCardProps) {
  const year = game.firstReleaseDate ? game.firstReleaseDate.slice(0, 4) : null;
  const extraPlatforms = game.platforms.length - 1;

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
      const updated = await apiClient.put<GameEntry>(`/api/games/${game.igdbId}/entry`, {
        favorited: !wasFavorited,
      });
      setLocalEntry(updated);
    } catch {
      setLocalEntry(previous);
    }
  }

  async function toggleCompleted(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    const wasCompleted = localEntry?.status === COMPLETED_STATUS;
    const nextStatus = wasCompleted ? null : COMPLETED_STATUS;
    const previous = localEntry;
    setLocalEntry(withPatch(localEntry, { status: nextStatus }));
    try {
      const updated = await apiClient.put<GameEntry>(`/api/games/${game.igdbId}/entry`, {
        status: nextStatus,
      });
      setLocalEntry(updated);
    } catch {
      setLocalEntry(previous);
    }
  }

  const favorited = localEntry?.favoritedAt != null;
  const completed = localEntry?.status === COMPLETED_STATUS;

  return (
    <Link to={`/jogos/${game.igdbId}`} className={styles.card}>
      <div className={styles.coverWrap}>
        {game.coverUrl ? (
          <img className={styles.cover} src={game.coverUrl} alt="" loading="lazy" />
        ) : (
          <div className={styles.coverPlaceholder} aria-hidden="true" />
        )}
        {game.rating !== null && (
          <span className={styles.ratingBadge}>{Math.round(game.rating)}</span>
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
            aria-pressed={completed}
            aria-label={completed ? "Desmarcar como finalizado" : "Marcar como finalizado"}
            onClick={toggleCompleted}
          >
            ✓
          </button>
        )}
      </div>
      <div className={styles.info}>
        <p className={styles.name}>{game.name}</p>
        <p className={styles.meta}>
          {year ?? "Data desconhecida"}
          {game.platforms.length > 0 &&
            ` · ${game.platforms[0]}${extraPlatforms > 0 ? ` +${extraPlatforms}` : ""}`}
        </p>
        {/* Sempre reserva a linha quando há entry, com status/nota ou vazia —
            senão os cards sem nenhum dos dois ficam mais baixos que os
            vizinhos que têm, quebrando o alinhamento da fileira no grid. */}
        {localEntry && (
          <p className={styles.entryMeta}>
            {localEntry.status && (
              <span className={styles.statusPill}>{GAME_STATUS_LABELS[localEntry.status]}</span>
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

import type { SeriesEntry, SeriesSummary } from "@cqntrack/shared";
import { useContext, useState, type MouseEvent } from "react";
import { Link } from "react-router";
import { apiClient } from "../lib/api-client";
import { ConfirmContext } from "../lib/ConfirmDialogContext";
import styles from "./SeriesCard.module.css";

interface SeriesCardProps {
  series: SeriesSummary;
  // Presente nas telas que já sabem a marcação do usuário pra série
  // (marcações, listas, busca, descobrir, perfil) — null quando a série
  // nunca foi marcada, undefined nas raras telas que ainda não carregam
  // entry nenhuma.
  entry?: SeriesEntry | null;
  // Ações rápidas (favoritar/marcar série inteira assistida) só aparecem
  // quando true — nunca no perfil público de outra pessoa
  // (apps/cqntrack_fe/src/profile/* usa o Card sem essa prop de propósito).
  // Por isso o hook de confirmação é lido via useContext direto (não o
  // useConfirm() que lança erro sem provider): quando interactive é false
  // este componente pode renderizar fora do ConfirmDialogProvider (só
  // montado no AppShell autenticado, não no layout do perfil público) sem
  // quebrar a página.
  interactive?: boolean;
}

// "YYYY-MM-DD" -> "DD/MM", sem passar por Date (evita o clássico bug de
// fuso: new Date("YYYY-MM-DD") vira meia-noite UTC, e toLocaleDateString
// num fuso atrás de UTC — caso do Brasil — mostraria o dia anterior).
function formatShortDate(isoDate: string): string {
  const [, month, day] = isoDate.split("-");
  return `${day}/${month}`;
}

function withPatch(current: SeriesEntry | null, patch: Partial<SeriesEntry>): SeriesEntry {
  return {
    id: current?.id ?? "",
    rating: current?.rating ?? null,
    watchedEpisodeCount: current?.watchedEpisodeCount ?? 0,
    favoritedAt: current?.favoritedAt ?? null,
    abandonedAt: current?.abandonedAt ?? null,
    review: current?.review ?? null,
    updatedAt: current?.updatedAt ?? new Date().toISOString(),
    availableEpisode: current?.availableEpisode ?? null,
    upcomingEpisode: current?.upcomingEpisode ?? null,
    ...patch,
  };
}

// Cartão de série reutilizado em busca, listas, marcações e perfil público —
// sempre linka pro detalhe da série (/series/:tmdbId). Card inteiro é um
// <Link>, então os botões de ação rápida precisam de preventDefault +
// stopPropagation pra não disparar a navegação junto do clique.
export function SeriesCard({ series, entry, interactive = false }: SeriesCardProps) {
  const confirm = useContext(ConfirmContext);
  const year = series.firstAirDate ? series.firstAirDate.slice(0, 4) : null;
  const extraGenres = series.genres.length - 1;

  // Estado local otimista pras ações rápidas — reverte se o PUT falhar (ou
  // fica com a aproximação otimista após watch-all, ver markAllWatched
  // abaixo). Ressincroniza quando a prop `entry` muda de verdade (ex.: grid
  // recarregado do zero), mesmo padrão "trackedX" já usado em
  // SeriesEpisodeList/MangaVolumeList.
  const [localEntry, setLocalEntry] = useState(entry ?? null);
  const [trackedEntry, setTrackedEntry] = useState(entry);
  if (entry !== trackedEntry) {
    setTrackedEntry(entry);
    setLocalEntry(entry ?? null);
  }
  const [markAllPending, setMarkAllPending] = useState(false);

  async function toggleFavorite(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    const wasFavorited = localEntry?.favoritedAt != null;
    const previous = localEntry;
    setLocalEntry(
      withPatch(localEntry, { favoritedAt: wasFavorited ? null : new Date().toISOString() }),
    );
    try {
      const updated = await apiClient.put<SeriesEntry>(`/api/series/${series.tmdbId}/entry`, {
        favorited: !wasFavorited,
      });
      setLocalEntry(updated);
    } catch {
      setLocalEntry(previous);
    }
  }

  // Série não tem status pra alternar (só progresso por episódio) — "marcar"
  // no Card dispara o endpoint bulk da Fase 5 (watch-all), com confirmação
  // antes (ação de alcance maior que o de outras seções). Sem "desmarcar":
  // o endpoint bulk só marca, mesmo espírito de toggleCompleted em
  // Game/MovieCard não ter equivalente aqui.
  async function markAllWatched(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!confirm) return;
    if (!(await confirm("Marcar todas as temporadas desta série como assistidas?"))) {
      return;
    }

    setMarkAllPending(true);
    try {
      await apiClient.put(`/api/series/${series.tmdbId}/watch-all`);
      setLocalEntry((current) =>
        withPatch(current, {
          watchedEpisodeCount: series.numberOfEpisodes ?? current?.watchedEpisodeCount ?? 0,
          availableEpisode: null,
        }),
      );
    } catch {
      // Silencioso — o botão continua clicável pra tentar de novo.
    } finally {
      setMarkAllPending(false);
    }
  }

  const favorited = localEntry?.favoritedAt != null;
  const fullyWatched =
    series.numberOfEpisodes != null && localEntry?.watchedEpisodeCount === series.numberOfEpisodes;

  return (
    <Link to={`/series/${series.tmdbId}`} className={styles.card}>
      <div className={styles.coverWrap}>
        {series.posterUrl ? (
          <img className={styles.cover} src={series.posterUrl} alt="" loading="lazy" />
        ) : (
          <div className={styles.coverPlaceholder} aria-hidden="true" />
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
        <div className={styles.topRightGroup}>
          {interactive && (
            <button
              type="button"
              className={styles.completeButton}
              aria-pressed={fullyWatched}
              disabled={markAllPending}
              aria-label="Marcar série inteira como assistida"
              onClick={markAllWatched}
            >
              ✓
            </button>
          )}
          {series.rating !== null && (
            <span className={styles.ratingBadge}>{series.rating.toFixed(1)}</span>
          )}
        </div>
        {/* Só um dos dois de cada vez — "já disponível" é mais acionável
            (e mutuamente exclusivo na prática: a TMDB só prevê o próximo
            episódio depois que o anterior já foi ao ar). */}
        {localEntry?.availableEpisode ? (
          <span className={styles.newEpisodeBadge}>Novo episódio</span>
        ) : (
          localEntry?.upcomingEpisode && (
            <span className={styles.upcomingEpisodeBadge}>
              Previsto {formatShortDate(localEntry.upcomingEpisode.airDate)}
            </span>
          )
        )}
      </div>
      <div className={styles.info}>
        <p className={styles.name}>{series.name}</p>
        <p className={styles.meta}>
          {year ?? "Data desconhecida"}
          {series.genres.length > 0 &&
            ` · ${series.genres[0]}${extraGenres > 0 ? ` +${extraGenres}` : ""}`}
        </p>
        {/* Sempre reserva a linha quando há entry, com progresso/nota ou
            vazia — senão os cards sem nenhum dos dois ficam mais baixos que
            os vizinhos que têm, quebrando o alinhamento da fileira no grid. */}
        {localEntry && (
          <p className={styles.entryMeta}>
            {localEntry.watchedEpisodeCount > 0 && (
              <span className={styles.progressPill}>
                {localEntry.watchedEpisodeCount}/{series.numberOfEpisodes ?? "?"} ep.
              </span>
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

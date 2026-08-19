import type { SeriesEntry, SeriesSummary } from "@cqntrack/shared";
import { Link } from "react-router";
import styles from "./SeriesCard.module.css";

interface SeriesCardProps {
  series: SeriesSummary;
  // Presente nas telas que já sabem a marcação do usuário pra série
  // (marcações, listas, perfil) — ausente na busca, onde não existe ainda.
  entry?: SeriesEntry;
}

// "YYYY-MM-DD" -> "DD/MM", sem passar por Date (evita o clássico bug de
// fuso: new Date("YYYY-MM-DD") vira meia-noite UTC, e toLocaleDateString
// num fuso atrás de UTC — caso do Brasil — mostraria o dia anterior).
function formatShortDate(isoDate: string): string {
  const [, month, day] = isoDate.split("-");
  return `${day}/${month}`;
}

// Cartão de série reutilizado em busca, listas, marcações e perfil público —
// sempre linka pro detalhe da série (/series/:tmdbId).
export function SeriesCard({ series, entry }: SeriesCardProps) {
  const year = series.firstAirDate ? series.firstAirDate.slice(0, 4) : null;
  const extraGenres = series.genres.length - 1;

  return (
    <Link to={`/series/${series.tmdbId}`} className={styles.card}>
      <div className={styles.coverWrap}>
        {series.posterUrl ? (
          <img className={styles.cover} src={series.posterUrl} alt="" loading="lazy" />
        ) : (
          <div className={styles.coverPlaceholder} aria-hidden="true" />
        )}
        {series.rating !== null && (
          <span className={styles.ratingBadge}>{series.rating.toFixed(1)}</span>
        )}
        {entry?.favoritedAt != null && (
          <span className={styles.favoriteBadge} aria-label="Favoritado">
            ♥
          </span>
        )}
        {/* Só um dos dois de cada vez — "já disponível" é mais acionável
            (e mutuamente exclusivo na prática: a TMDB só prevê o próximo
            episódio depois que o anterior já foi ao ar). */}
        {entry?.availableEpisode ? (
          <span className={styles.newEpisodeBadge}>Novo episódio</span>
        ) : (
          entry?.upcomingEpisode && (
            <span className={styles.upcomingEpisodeBadge}>
              Previsto {formatShortDate(entry.upcomingEpisode.airDate)}
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
        {entry && (
          <p className={styles.entryMeta}>
            {entry.watchedEpisodeCount > 0 && (
              <span className={styles.progressPill}>
                {entry.watchedEpisodeCount}/{series.numberOfEpisodes ?? "?"} ep.
              </span>
            )}
            {entry.rating !== null && (
              <span className={styles.personalRating}>★ {entry.rating.toFixed(1)}</span>
            )}
          </p>
        )}
      </div>
    </Link>
  );
}

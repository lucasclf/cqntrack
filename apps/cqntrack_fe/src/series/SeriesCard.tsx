import { SERIES_STATUS_LABELS, type SeriesEntry, type SeriesSummary } from "@cqntrack/shared";
import { Link } from "react-router";
import styles from "./SeriesCard.module.css";

interface SeriesCardProps {
  series: SeriesSummary;
  // Presente nas telas que já sabem a marcação do usuário pra série
  // (marcações, listas, perfil) — ausente na busca, onde não existe ainda.
  entry?: SeriesEntry;
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
        {entry?.favoriteSlot != null && (
          <span className={styles.favoriteBadge} aria-label="Favoritado">
            ♥
          </span>
        )}
      </div>
      <div className={styles.info}>
        <p className={styles.name}>{series.name}</p>
        <p className={styles.meta}>
          {year ?? "Data desconhecida"}
          {series.genres.length > 0 &&
            ` · ${series.genres[0]}${extraGenres > 0 ? ` +${extraGenres}` : ""}`}
        </p>
        {/* Sempre reserva a linha quando há entry, com status/nota ou vazia —
            senão os cards sem nenhum dos dois ficam mais baixos que os
            vizinhos que têm, quebrando o alinhamento da fileira no grid. */}
        {entry && (
          <p className={styles.entryMeta}>
            {entry.status && (
              <span className={styles.statusPill}>{SERIES_STATUS_LABELS[entry.status]}</span>
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

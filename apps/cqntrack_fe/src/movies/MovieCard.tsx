import { MOVIE_STATUS_LABELS, type MovieEntry, type MovieSummary } from "@cqntrack/shared";
import { Link } from "react-router";
import styles from "./MovieCard.module.css";

interface MovieCardProps {
  movie: MovieSummary;
  // Presente nas telas que já sabem a marcação do usuário pro filme
  // (marcações, listas, perfil) — ausente na busca, onde não existe ainda.
  entry?: MovieEntry;
}

// Cartão de filme reutilizado em busca, listas, marcações e perfil público —
// sempre linka pro detalhe do filme (/filmes/:tmdbId).
export function MovieCard({ movie, entry }: MovieCardProps) {
  const year = movie.releaseDate ? movie.releaseDate.slice(0, 4) : null;
  const extraGenres = movie.genres.length - 1;

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
        {entry?.favoritedAt != null && (
          <span className={styles.favoriteBadge} aria-label="Favoritado">
            ♥
          </span>
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
        {entry && (
          <p className={styles.entryMeta}>
            {entry.status && <span className={styles.statusPill}>{MOVIE_STATUS_LABELS[entry.status]}</span>}
            {entry.rating !== null && (
              <span className={styles.personalRating}>★ {entry.rating.toFixed(1)}</span>
            )}
          </p>
        )}
      </div>
    </Link>
  );
}

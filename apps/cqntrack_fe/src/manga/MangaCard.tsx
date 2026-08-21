import { MANGA_STATUS_LABELS, type MangaEntry, type MangaSummary } from "@cqntrack/shared";
import { Link } from "react-router";
import styles from "./MangaCard.module.css";

interface MangaCardProps {
  manga: MangaSummary;
  // Presente nas telas que já sabem a marcação do usuário pro mangá
  // (marcações, listas, perfil) — ausente na busca/descobrir, onde não
  // existe ainda.
  entry?: MangaEntry;
}

// Cartão de mangá reutilizado em busca, descobrir, listas, marcações e
// perfil público — sempre linka pro detalhe (/mangas/:mangadexId).
export function MangaCard({ manga, entry }: MangaCardProps) {
  const extraAuthors = manga.authors.length - 1;

  return (
    <Link to={`/mangas/${manga.mangadexId}`} className={styles.card}>
      <div className={styles.coverWrap}>
        {manga.coverUrl ? (
          <img className={styles.cover} src={manga.coverUrl} alt="" loading="lazy" />
        ) : (
          <div className={styles.coverPlaceholder} aria-hidden="true" />
        )}
        {entry?.favoritedAt != null && (
          <span className={styles.favoriteBadge} aria-label="Favoritado">
            ♥
          </span>
        )}
      </div>
      <div className={styles.info}>
        <p className={styles.name}>{manga.title}</p>
        <p className={styles.meta}>
          {manga.year ?? "Ano desconhecido"}
          {manga.authors.length > 0 &&
            ` · ${manga.authors[0]?.name}${extraAuthors > 0 ? ` +${extraAuthors}` : ""}`}
        </p>
        {/* Sempre reserva a linha quando há entry, com status/nota ou vazia —
            senão os cards sem nenhum dos dois ficam mais baixos que os
            vizinhos que têm, quebrando o alinhamento da fileira no grid. */}
        {entry && (
          <p className={styles.entryMeta}>
            {entry.status && (
              <span className={styles.statusPill}>{MANGA_STATUS_LABELS[entry.status]}</span>
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

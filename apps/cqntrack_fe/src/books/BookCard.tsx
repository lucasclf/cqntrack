import { BOOK_STATUS_LABELS, type BookEntry, type BookSummary } from "@cqntrack/shared";
import { Link } from "react-router";
import styles from "./BookCard.module.css";

interface BookCardProps {
  book: BookSummary;
  // Presente nas telas que já sabem a marcação do usuário pro livro
  // (marcações, listas, perfil) — ausente na busca, onde não existe ainda.
  entry?: BookEntry;
}

// Cartão de livro reutilizado em busca, listas, marcações e perfil público —
// sempre linka pro detalhe do livro (/livros/:googleBooksId).
export function BookCard({ book, entry }: BookCardProps) {
  const year = book.publishedDate ? book.publishedDate.slice(0, 4) : null;
  const extraAuthors = book.authors.length - 1;

  return (
    <Link to={`/livros/${book.googleBooksId}`} className={styles.card}>
      <div className={styles.coverWrap}>
        {book.coverUrl ? (
          <img className={styles.cover} src={book.coverUrl} alt="" loading="lazy" />
        ) : (
          <div className={styles.coverPlaceholder} aria-hidden="true" />
        )}
        {book.rating !== null && <span className={styles.ratingBadge}>{book.rating.toFixed(1)}</span>}
        {entry?.favoriteSlot != null && (
          <span className={styles.favoriteBadge} aria-label="Favoritado">
            ♥
          </span>
        )}
      </div>
      <div className={styles.info}>
        <p className={styles.name}>{book.title}</p>
        <p className={styles.meta}>
          {year ?? "Data desconhecida"}
          {book.authors.length > 0 && ` · ${book.authors[0]}${extraAuthors > 0 ? ` +${extraAuthors}` : ""}`}
        </p>
        {/* Sempre reserva a linha quando há entry, com status/nota ou vazia —
            senão os cards sem nenhum dos dois ficam mais baixos que os
            vizinhos que têm, quebrando o alinhamento da fileira no grid. */}
        {entry && (
          <p className={styles.entryMeta}>
            {entry.status && <span className={styles.statusPill}>{BOOK_STATUS_LABELS[entry.status]}</span>}
            {entry.rating !== null && (
              <span className={styles.personalRating}>★ {entry.rating.toFixed(1)}</span>
            )}
          </p>
        )}
      </div>
    </Link>
  );
}

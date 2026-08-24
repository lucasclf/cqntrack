import {
  BOOK_STATUS_LABELS,
  type BookEntry,
  type BookStatus,
  type BookSummary,
} from "@cqntrack/shared";
import { useState, type MouseEvent } from "react";
import { Link } from "react-router";
import { apiClient } from "../lib/api-client";
import styles from "./BookCard.module.css";

interface BookCardProps {
  book: BookSummary;
  // Presente nas telas que já sabem a marcação do usuário pro livro
  // (marcações, listas, busca, perfil) — null quando o livro nunca foi
  // marcado, undefined nas raras telas que ainda não carregam entry
  // nenhuma.
  entry?: BookEntry | null;
  // Ações rápidas (favoritar/marcar lido) só aparecem quando true — nunca
  // no perfil público de outra pessoa (apps/cqntrack_fe/src/profile/* usa o
  // Card sem essa prop de propósito: lá a entry é de quem é dono do
  // perfil, não de quem está vendo — clicar não pode mexer no dado de
  // outra conta).
  interactive?: boolean;
}

const READ_STATUS: BookStatus = "read";

function withPatch(current: BookEntry | null, patch: Partial<BookEntry>): BookEntry {
  return {
    id: current?.id ?? "",
    status: current?.status ?? null,
    rating: current?.rating ?? null,
    favoritedAt: current?.favoritedAt ?? null,
    review: current?.review ?? null,
    updatedAt: current?.updatedAt ?? new Date().toISOString(),
    ...patch,
  };
}

// Cartão de livro reutilizado em busca, listas, marcações e perfil público —
// sempre linka pro detalhe do livro (/livros/:googleBooksId). Card inteiro é
// um <Link>, então os botões de ação rápida precisam de preventDefault +
// stopPropagation pra não disparar a navegação junto do clique.
export function BookCard({ book, entry, interactive = false }: BookCardProps) {
  const year = book.publishedDate ? book.publishedDate.slice(0, 4) : null;
  const extraAuthors = book.authors.length - 1;

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
      const updated = await apiClient.put<BookEntry>(`/api/books/${book.googleBooksId}/entry`, {
        favorited: !wasFavorited,
      });
      setLocalEntry(updated);
    } catch {
      setLocalEntry(previous);
    }
  }

  async function toggleRead(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    const wasRead = localEntry?.status === READ_STATUS;
    const nextStatus = wasRead ? null : READ_STATUS;
    const previous = localEntry;
    setLocalEntry(withPatch(localEntry, { status: nextStatus }));
    try {
      const updated = await apiClient.put<BookEntry>(`/api/books/${book.googleBooksId}/entry`, {
        status: nextStatus,
      });
      setLocalEntry(updated);
    } catch {
      setLocalEntry(previous);
    }
  }

  const favorited = localEntry?.favoritedAt != null;
  const read = localEntry?.status === READ_STATUS;

  return (
    <Link to={`/livros/${book.googleBooksId}`} className={styles.card}>
      <div className={styles.coverWrap}>
        {book.coverUrl ? (
          <img className={styles.cover} src={book.coverUrl} alt="" loading="lazy" />
        ) : (
          <div className={styles.coverPlaceholder} aria-hidden="true" />
        )}
        {book.rating !== null && (
          <span className={styles.ratingBadge}>{book.rating.toFixed(1)}</span>
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
            aria-pressed={read}
            aria-label={read ? "Desmarcar como lido" : "Marcar como lido"}
            onClick={toggleRead}
          >
            ✓
          </button>
        )}
      </div>
      <div className={styles.info}>
        <p className={styles.name}>{book.title}</p>
        <p className={styles.meta}>
          {year ?? "Data desconhecida"}
          {book.authors.length > 0 &&
            ` · ${book.authors[0]}${extraAuthors > 0 ? ` +${extraAuthors}` : ""}`}
        </p>
        {/* Sempre reserva a linha quando há entry, com status/nota ou vazia —
            senão os cards sem nenhum dos dois ficam mais baixos que os
            vizinhos que têm, quebrando o alinhamento da fileira no grid. */}
        {localEntry && (
          <p className={styles.entryMeta}>
            {localEntry.status && (
              <span className={styles.statusPill}>{BOOK_STATUS_LABELS[localEntry.status]}</span>
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

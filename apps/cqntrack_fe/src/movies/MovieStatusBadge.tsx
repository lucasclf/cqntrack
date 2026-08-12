import { MOVIE_STATUSES, MOVIE_STATUS_LABELS, type MovieStatus } from "@cqntrack/shared";
import styles from "./MovieStatusBadge.module.css";

interface MovieStatusBadgeProps {
  status: MovieStatus | null;
  onChange?: (status: MovieStatus | null) => void;
}

// Cópia estrutural de books/BookStatusBadge.tsx, trocando os 4 status de
// livro pelos 2 de filme. Sem onChange: badge estático. Com onChange:
// seletor toggle (clicar no status já selecionado desmarca).
export function MovieStatusBadge({ status, onChange }: MovieStatusBadgeProps) {
  if (!onChange) {
    if (!status) {
      return null;
    }
    return (
      <span className={styles.badge} data-status={status}>
        {MOVIE_STATUS_LABELS[status]}
      </span>
    );
  }

  return (
    <div className={styles.select} role="group" aria-label="Status">
      {MOVIE_STATUSES.map((option) => (
        <button
          key={option}
          type="button"
          className={status === option ? `${styles.option} ${styles.optionActive}` : styles.option}
          aria-pressed={status === option}
          onClick={() => onChange(status === option ? null : option)}
        >
          {MOVIE_STATUS_LABELS[option]}
        </button>
      ))}
    </div>
  );
}

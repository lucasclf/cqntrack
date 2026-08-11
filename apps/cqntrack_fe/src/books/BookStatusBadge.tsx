import { BOOK_STATUSES, BOOK_STATUS_LABELS, type BookStatus } from "@cqntrack/shared";
import styles from "./BookStatusBadge.module.css";

interface BookStatusBadgeProps {
  status: BookStatus | null;
  onChange?: (status: BookStatus | null) => void;
}

// Sem onChange: badge estático (uso futuro em BookCard/perfil). Com onChange:
// seletor dos 4 status fixos (campo único, sem histórico completo) — clicar
// no status já selecionado desmarca (deixa o livro sem status nenhum).
export function BookStatusBadge({ status, onChange }: BookStatusBadgeProps) {
  if (!onChange) {
    if (!status) {
      return null;
    }
    return (
      <span className={styles.badge} data-status={status}>
        {BOOK_STATUS_LABELS[status]}
      </span>
    );
  }

  return (
    <div className={styles.select} role="group" aria-label="Status">
      {BOOK_STATUSES.map((option) => (
        <button
          key={option}
          type="button"
          className={status === option ? `${styles.option} ${styles.optionActive}` : styles.option}
          aria-pressed={status === option}
          onClick={() => onChange(status === option ? null : option)}
        >
          {BOOK_STATUS_LABELS[option]}
        </button>
      ))}
    </div>
  );
}

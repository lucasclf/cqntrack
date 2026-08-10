import { SERIES_STATUSES, SERIES_STATUS_LABELS, type SeriesStatus } from "@cqntrack/shared";
import styles from "./SeriesStatusBadge.module.css";

interface SeriesStatusBadgeProps {
  status: SeriesStatus | null;
  onChange?: (status: SeriesStatus | null) => void;
}

// Sem onChange: badge estático (uso futuro em SeriesCard/perfil). Com
// onChange: seletor dos 4 status fixos (campo único, sem histórico
// completo) — clicar no status já selecionado desmarca.
export function SeriesStatusBadge({ status, onChange }: SeriesStatusBadgeProps) {
  if (!onChange) {
    if (!status) {
      return null;
    }
    return (
      <span className={styles.badge} data-status={status}>
        {SERIES_STATUS_LABELS[status]}
      </span>
    );
  }

  return (
    <div className={styles.select} role="group" aria-label="Status">
      {SERIES_STATUSES.map((option) => (
        <button
          key={option}
          type="button"
          className={status === option ? `${styles.option} ${styles.optionActive}` : styles.option}
          aria-pressed={status === option}
          onClick={() => onChange(status === option ? null : option)}
        >
          {SERIES_STATUS_LABELS[option]}
        </button>
      ))}
    </div>
  );
}

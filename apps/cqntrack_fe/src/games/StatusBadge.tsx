import { GAME_STATUSES, GAME_STATUS_LABELS, type GameStatus } from "@cqntrack/shared";
import styles from "./StatusBadge.module.css";

interface StatusBadgeProps {
  status: GameStatus | null;
  onChange?: (status: GameStatus) => void;
}

// Sem onChange: badge estático (uso futuro em GameCard/perfil). Com onChange:
// seletor dos 5 status fixos (campo único, sem histórico completo).
export function StatusBadge({ status, onChange }: StatusBadgeProps) {
  if (!onChange) {
    if (!status) {
      return null;
    }
    return (
      <span className={styles.badge} data-status={status}>
        {GAME_STATUS_LABELS[status]}
      </span>
    );
  }

  return (
    <div className={styles.select} role="group" aria-label="Status">
      {GAME_STATUSES.map((option) => (
        <button
          key={option}
          type="button"
          className={status === option ? `${styles.option} ${styles.optionActive}` : styles.option}
          aria-pressed={status === option}
          onClick={() => onChange(option)}
        >
          {GAME_STATUS_LABELS[option]}
        </button>
      ))}
    </div>
  );
}

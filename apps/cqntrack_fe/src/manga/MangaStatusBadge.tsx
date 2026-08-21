import { MANGA_STATUSES, MANGA_STATUS_LABELS, type MangaStatus } from "@cqntrack/shared";
import styles from "./MangaStatusBadge.module.css";

interface MangaStatusBadgeProps {
  status: MangaStatus | null;
  onChange?: (status: MangaStatus | null) => void;
}

// Sem onChange: badge estático (uso futuro em MangaCard/perfil). Com
// onChange: seletor dos 4 status fixos (campo único, sem histórico
// completo) — clicar no status já selecionado desmarca (deixa o mangá sem
// status nenhum). Mesmo padrão de BookStatusBadge.
export function MangaStatusBadge({ status, onChange }: MangaStatusBadgeProps) {
  if (!onChange) {
    if (!status) {
      return null;
    }
    return (
      <span className={styles.badge} data-status={status}>
        {MANGA_STATUS_LABELS[status]}
      </span>
    );
  }

  return (
    <div className={styles.select} role="group" aria-label="Status">
      {MANGA_STATUSES.map((option) => (
        <button
          key={option}
          type="button"
          className={status === option ? `${styles.option} ${styles.optionActive}` : styles.option}
          aria-pressed={status === option}
          onClick={() => onChange(status === option ? null : option)}
        >
          {MANGA_STATUS_LABELS[option]}
        </button>
      ))}
    </div>
  );
}

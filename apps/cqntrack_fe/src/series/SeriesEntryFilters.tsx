import { SERIES_ENTRY_SORT_FIELDS, SERIES_STATUSES, SERIES_STATUS_LABELS, type SeriesStatus } from "@cqntrack/shared";
import styles from "./SeriesEntryFilters.module.css";

export type SeriesEntrySortField = (typeof SERIES_ENTRY_SORT_FIELDS)[number];

const SORT_FIELD_LABELS: Record<SeriesEntrySortField, string> = {
  status: "Status",
  rating: "Nota",
  favorite: "Favorito",
  updatedAt: "Atualizado em",
};

interface SeriesEntryFiltersProps {
  status: SeriesStatus | "";
  onStatusChange: (status: SeriesStatus | "") => void;
  favoriteOnly: boolean;
  onFavoriteOnlyChange: (value: boolean) => void;
  sortBy: SeriesEntrySortField;
  onSortByChange: (value: SeriesEntrySortField) => void;
  order: "asc" | "desc";
  onOrderChange: (value: "asc" | "desc") => void;
}

// Sem campo de plataforma — sem equivalente pra série (diferente de
// EntryFilters de jogos).
export function SeriesEntryFilters({
  status,
  onStatusChange,
  favoriteOnly,
  onFavoriteOnlyChange,
  sortBy,
  onSortByChange,
  order,
  onOrderChange,
}: SeriesEntryFiltersProps) {
  return (
    <div className={styles.filters}>
      <label className={styles.field}>
        <span>Status</span>
        <select
          value={status}
          onChange={(event) => onStatusChange(event.target.value as SeriesStatus | "")}
        >
          <option value="">Todos</option>
          {SERIES_STATUSES.map((option) => (
            <option key={option} value={option}>
              {SERIES_STATUS_LABELS[option]}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span>Ordenar por</span>
        <select
          value={sortBy}
          onChange={(event) => onSortByChange(event.target.value as SeriesEntrySortField)}
        >
          {SERIES_ENTRY_SORT_FIELDS.map((field) => (
            <option key={field} value={field}>
              {SORT_FIELD_LABELS[field]}
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        className={styles.orderButton}
        onClick={() => onOrderChange(order === "asc" ? "desc" : "asc")}
      >
        {order === "asc" ? "Crescente ↑" : "Decrescente ↓"}
      </button>

      <label className={`${styles.field} ${styles.checkboxField}`}>
        <input
          type="checkbox"
          checked={favoriteOnly}
          onChange={(event) => onFavoriteOnlyChange(event.target.checked)}
        />
        <span>Somente favoritos</span>
      </label>
    </div>
  );
}

import { MOVIE_ENTRY_SORT_FIELDS, MOVIE_STATUSES, MOVIE_STATUS_LABELS, type MovieStatus } from "@cqntrack/shared";
import styles from "./MovieEntryFilters.module.css";

export type MovieEntrySortField = (typeof MOVIE_ENTRY_SORT_FIELDS)[number];

const SORT_FIELD_LABELS: Record<MovieEntrySortField, string> = {
  status: "Status",
  rating: "Nota",
  favorite: "Favorito",
  updatedAt: "Atualizado em",
};

interface MovieEntryFiltersProps {
  status: MovieStatus | "";
  onStatusChange: (status: MovieStatus | "") => void;
  favoriteOnly: boolean;
  onFavoriteOnlyChange: (value: boolean) => void;
  sortBy: MovieEntrySortField;
  onSortByChange: (value: MovieEntrySortField) => void;
  order: "asc" | "desc";
  onOrderChange: (value: "asc" | "desc") => void;
}

export function MovieEntryFilters({
  status,
  onStatusChange,
  favoriteOnly,
  onFavoriteOnlyChange,
  sortBy,
  onSortByChange,
  order,
  onOrderChange,
}: MovieEntryFiltersProps) {
  return (
    <div className={styles.filters}>
      <label className={styles.field}>
        <span>Status</span>
        <select value={status} onChange={(event) => onStatusChange(event.target.value as MovieStatus | "")}>
          <option value="">Todos</option>
          {MOVIE_STATUSES.map((option) => (
            <option key={option} value={option}>
              {MOVIE_STATUS_LABELS[option]}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span>Ordenar por</span>
        <select
          value={sortBy}
          onChange={(event) => onSortByChange(event.target.value as MovieEntrySortField)}
        >
          {MOVIE_ENTRY_SORT_FIELDS.map((field) => (
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

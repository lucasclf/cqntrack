import {
  BOOK_ENTRY_SORT_FIELDS,
  BOOK_STATUSES,
  BOOK_STATUS_LABELS,
  type BookStatus,
} from "@cqntrack/shared";
import styles from "./BookEntryFilters.module.css";

export type BookEntrySortField = (typeof BOOK_ENTRY_SORT_FIELDS)[number];

const SORT_FIELD_LABELS: Record<BookEntrySortField, string> = {
  status: "Status",
  rating: "Nota",
  favorite: "Favorito",
  updatedAt: "Atualizado em",
};

interface BookEntryFiltersProps {
  status: BookStatus | "";
  onStatusChange: (status: BookStatus | "") => void;
  favoriteOnly: boolean;
  onFavoriteOnlyChange: (value: boolean) => void;
  sortBy: BookEntrySortField;
  onSortByChange: (value: BookEntrySortField) => void;
  order: "asc" | "desc";
  onOrderChange: (value: "asc" | "desc") => void;
}

export function BookEntryFilters({
  status,
  onStatusChange,
  favoriteOnly,
  onFavoriteOnlyChange,
  sortBy,
  onSortByChange,
  order,
  onOrderChange,
}: BookEntryFiltersProps) {
  return (
    <div className={styles.filters}>
      <label className={styles.field}>
        <span>Status</span>
        <select
          value={status}
          onChange={(event) => onStatusChange(event.target.value as BookStatus | "")}
        >
          <option value="">Todos</option>
          {BOOK_STATUSES.map((option) => (
            <option key={option} value={option}>
              {BOOK_STATUS_LABELS[option]}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span>Ordenar por</span>
        <select
          value={sortBy}
          onChange={(event) => onSortByChange(event.target.value as BookEntrySortField)}
        >
          {BOOK_ENTRY_SORT_FIELDS.map((field) => (
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

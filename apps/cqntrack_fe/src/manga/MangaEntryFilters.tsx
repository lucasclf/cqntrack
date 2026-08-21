import {
  MANGA_ENTRY_SORT_FIELDS,
  MANGA_STATUSES,
  MANGA_STATUS_LABELS,
  type MangaStatus,
} from "@cqntrack/shared";
import styles from "./MangaEntryFilters.module.css";

export type MangaEntrySortField = (typeof MANGA_ENTRY_SORT_FIELDS)[number];

const SORT_FIELD_LABELS: Record<MangaEntrySortField, string> = {
  status: "Status",
  rating: "Nota",
  favorite: "Favorito",
  updatedAt: "Atualizado em",
};

interface MangaEntryFiltersProps {
  status: MangaStatus | "";
  onStatusChange: (status: MangaStatus | "") => void;
  favoriteOnly: boolean;
  onFavoriteOnlyChange: (value: boolean) => void;
  sortBy: MangaEntrySortField;
  onSortByChange: (value: MangaEntrySortField) => void;
  order: "asc" | "desc";
  onOrderChange: (value: "asc" | "desc") => void;
}

export function MangaEntryFilters({
  status,
  onStatusChange,
  favoriteOnly,
  onFavoriteOnlyChange,
  sortBy,
  onSortByChange,
  order,
  onOrderChange,
}: MangaEntryFiltersProps) {
  return (
    <div className={styles.filters}>
      <label className={styles.field}>
        <span>Status</span>
        <select
          value={status}
          onChange={(event) => onStatusChange(event.target.value as MangaStatus | "")}
        >
          <option value="">Todos</option>
          {MANGA_STATUSES.map((option) => (
            <option key={option} value={option}>
              {MANGA_STATUS_LABELS[option]}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span>Ordenar por</span>
        <select
          value={sortBy}
          onChange={(event) => onSortByChange(event.target.value as MangaEntrySortField)}
        >
          {MANGA_ENTRY_SORT_FIELDS.map((field) => (
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

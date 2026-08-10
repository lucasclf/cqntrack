import { GAME_ENTRY_SORT_FIELDS, GAME_STATUSES, GAME_STATUS_LABELS, type GameStatus } from "@cqntrack/shared";
import styles from "./EntryFilters.module.css";

export type EntrySortField = (typeof GAME_ENTRY_SORT_FIELDS)[number];

const SORT_FIELD_LABELS: Record<EntrySortField, string> = {
  status: "Status",
  rating: "Nota",
  favorite: "Favorito",
  platform: "Plataforma",
  updatedAt: "Atualizado em",
};

interface EntryFiltersProps {
  status: GameStatus | "";
  onStatusChange: (status: GameStatus | "") => void;
  favoriteOnly: boolean;
  onFavoriteOnlyChange: (value: boolean) => void;
  platform: string;
  onPlatformChange: (value: string) => void;
  sortBy: EntrySortField;
  onSortByChange: (value: EntrySortField) => void;
  order: "asc" | "desc";
  onOrderChange: (value: "asc" | "desc") => void;
}

export function EntryFilters({
  status,
  onStatusChange,
  favoriteOnly,
  onFavoriteOnlyChange,
  platform,
  onPlatformChange,
  sortBy,
  onSortByChange,
  order,
  onOrderChange,
}: EntryFiltersProps) {
  return (
    <div className={styles.filters}>
      <label className={styles.field}>
        <span>Status</span>
        <select value={status} onChange={(event) => onStatusChange(event.target.value as GameStatus | "")}>
          <option value="">Todos</option>
          {GAME_STATUSES.map((option) => (
            <option key={option} value={option}>
              {GAME_STATUS_LABELS[option]}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span>Plataforma</span>
        <input
          type="text"
          value={platform}
          placeholder="ex.: PS5"
          onChange={(event) => onPlatformChange(event.target.value)}
        />
      </label>

      <label className={styles.field}>
        <span>Ordenar por</span>
        <select value={sortBy} onChange={(event) => onSortByChange(event.target.value as EntrySortField)}>
          {GAME_ENTRY_SORT_FIELDS.map((field) => (
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

import { MOVIE_ENTRY_SORT_FIELDS } from "@cqntrack/shared";
import styles from "./MovieEntryFilters.module.css";

export type MovieEntrySortField = (typeof MOVIE_ENTRY_SORT_FIELDS)[number];

const SORT_FIELD_LABELS: Record<MovieEntrySortField, string> = {
  rating: "Nota",
  favorite: "Favorito",
  updatedAt: "Atualizado em",
};

// "" = todos, sem filtrar por assistido — diferente de favoriteOnly (que é
// só um checkbox), esse filtro tem 3 estados, então vira <select>.
export type WatchedFilter = "" | "true" | "false";

interface MovieEntryFiltersProps {
  favoriteOnly: boolean;
  onFavoriteOnlyChange: (value: boolean) => void;
  watched: WatchedFilter;
  onWatchedChange: (value: WatchedFilter) => void;
  sortBy: MovieEntrySortField;
  onSortByChange: (value: MovieEntrySortField) => void;
  order: "asc" | "desc";
  onOrderChange: (value: "asc" | "desc") => void;
}

// Sem campo de plataforma — sem equivalente pra filme (diferente de
// EntryFilters de jogos).
export function MovieEntryFilters({
  favoriteOnly,
  onFavoriteOnlyChange,
  watched,
  onWatchedChange,
  sortBy,
  onSortByChange,
  order,
  onOrderChange,
}: MovieEntryFiltersProps) {
  return (
    <div className={styles.filters}>
      <label className={styles.field}>
        <span>Assistido</span>
        <select value={watched} onChange={(event) => onWatchedChange(event.target.value as WatchedFilter)}>
          <option value="">Todos</option>
          <option value="true">Assistidos</option>
          <option value="false">Não assistidos</option>
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

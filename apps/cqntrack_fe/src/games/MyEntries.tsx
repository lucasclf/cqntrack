import {
  GAME_STATUSES,
  type GameStatus,
  type PaginatedGameEntriesResponse,
} from "@cqntrack/shared";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { useDebouncedValue } from "../lib/useDebouncedValue";
import { usePaginatedEntries } from "../lib/usePaginatedEntries";
import { EntryFilters, type EntrySortField } from "./EntryFilters";
import { GameCard } from "./GameCard";
import styles from "./MyEntries.module.css";

// Lida só uma vez, na montagem — valor inicial do filtro quando se chega
// aqui por um link com ?status= (estatística clicável da home, ver
// GameStats); depois vira estado local normal.
function initialStatusFromUrl(searchParams: URLSearchParams): GameStatus | "" {
  const raw = searchParams.get("status");
  return raw !== null && (GAME_STATUSES as readonly string[]).includes(raw)
    ? (raw as GameStatus)
    : "";
}

export function MyEntries() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<GameStatus | "">(() => initialStatusFromUrl(searchParams));
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [platform, setPlatform] = useState("");
  const debouncedPlatform = useDebouncedValue(platform, 300).trim();
  const [sortBy, setSortBy] = useState<EntrySortField>("updatedAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  const { data, loadStatus, page, setPage, totalPages } =
    usePaginatedEntries<PaginatedGameEntriesResponse>(
      (page) => {
        const params = new URLSearchParams();
        if (status) params.set("status", status);
        if (favoriteOnly) params.set("favorite", "true");
        if (debouncedPlatform) params.set("platform", debouncedPlatform);
        params.set("sortBy", sortBy);
        params.set("order", order);
        params.set("page", String(page));
        return `/api/games/entries?${params.toString()}`;
      },
      { status, favoriteOnly, debouncedPlatform, sortBy, order },
    );

  return (
    <div className={styles.page}>
      <h1>Minhas marcações</h1>
      <EntryFilters
        status={status}
        onStatusChange={setStatus}
        favoriteOnly={favoriteOnly}
        onFavoriteOnlyChange={setFavoriteOnly}
        platform={platform}
        onPlatformChange={setPlatform}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        order={order}
        onOrderChange={setOrder}
      />

      {loadStatus === "loading" && !data && <p className={styles.hint}>Carregando...</p>}
      {loadStatus === "error" && (
        <p role="alert">Falha ao carregar suas marcações. Tente novamente.</p>
      )}
      {loadStatus === "ready" && data?.items.length === 0 && (
        <p className={styles.hint}>Nenhuma marcação encontrada com esses filtros.</p>
      )}

      {data && data.items.length > 0 && (
        <>
          <div className={styles.grid}>
            {data.items.map((item) => (
              <GameCard key={item.game.igdbId} game={item.game} entry={item} />
            ))}
          </div>
          <div className={styles.pagination}>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((current) => current - 1)}
            >
              Anterior
            </button>
            <span className={styles.pageInfo}>
              Página {page} de {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              Próxima
            </button>
          </div>
        </>
      )}
    </div>
  );
}

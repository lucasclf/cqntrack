import type { GameStatus, PaginatedGameEntriesResponse } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { gamesClient } from "../lib/games-client";
import { EntryFilters, type EntrySortField } from "./EntryFilters";
import { GameCard } from "./GameCard";
import styles from "./MyEntries.module.css";
import { useDebouncedValue } from "./useDebouncedValue";

type LoadStatus = "loading" | "ready" | "error";

export function MyEntries() {
  const [status, setStatus] = useState<GameStatus | "">("");
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [platform, setPlatform] = useState("");
  const debouncedPlatform = useDebouncedValue(platform, 300).trim();
  const [sortBy, setSortBy] = useState<EntrySortField>("updatedAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  // Volta pra página 1 sempre que um filtro/ordenação muda — ajustado durante
  // o render (mesmo padrão de GameSearch/GameDetail), não dentro do efeito.
  const filtersKey = JSON.stringify({ status, favoriteOnly, debouncedPlatform, sortBy, order });
  const [trackedFiltersKey, setTrackedFiltersKey] = useState(filtersKey);
  if (filtersKey !== trackedFiltersKey) {
    setTrackedFiltersKey(filtersKey);
    setPage(1);
  }

  const [data, setData] = useState<PaginatedGameEntriesResponse | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (favoriteOnly) params.set("favorite", "true");
    if (debouncedPlatform) params.set("platform", debouncedPlatform);
    params.set("sortBy", sortBy);
    params.set("order", order);
    params.set("page", String(page));

    gamesClient
      .get<PaginatedGameEntriesResponse>(`/api/games/entries?${params.toString()}`)
      .then((response) => {
        if (!cancelled) {
          setData(response);
          setLoadStatus("ready");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadStatus("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [status, favoriteOnly, debouncedPlatform, sortBy, order, page]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

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
      {loadStatus === "error" && <p role="alert">Falha ao carregar suas marcações. Tente novamente.</p>}
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
            <button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
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

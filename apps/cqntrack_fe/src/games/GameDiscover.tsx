import {
  GAME_DISCOVER_PLATFORMS,
  GAME_DISCOVER_PLATFORM_LABELS,
  type DiscoverGamesResponse,
  type GameDiscoverPlatform,
  type GameSummaryWithEntry,
} from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { MediaSearchInput } from "../components/MediaSearchInput";
import { apiClient } from "../lib/api-client";
import styles from "./GameDiscover.module.css";
import { GameCard } from "./GameCard";

type LoadStatus = "loading" | "idle" | "error";

// Índice da seção de jogos no menu superior — aclamados da própria IGDB
// (mesmo espírito de MovieDiscover/SeriesDiscover, "carregar mais").
export function GameDiscover() {
  const [results, setResults] = useState<GameSummaryWithEntry[]>([]);
  const [page, setPage] = useState(1);
  const [platform, setPlatform] = useState<GameDiscoverPlatform | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState<LoadStatus>("loading");

  // Volta pra "loading" assim que a página ou a plataforma mudam (ex.:
  // "Carregar mais" ou trocar o filtro) — feito durante o render (mesmo
  // padrão de MovieDiscover), não dentro do efeito abaixo.
  const [trackedPage, setTrackedPage] = useState(page);
  const [trackedPlatform, setTrackedPlatform] = useState(platform);
  if (page !== trackedPage || platform !== trackedPlatform) {
    setTrackedPage(page);
    setTrackedPlatform(platform);
    setStatus("loading");
  }

  function selectPlatform(next: GameDiscoverPlatform | null) {
    setPlatform(next);
    setPage(1);
  }

  useEffect(() => {
    let cancelled = false;
    const query = new URLSearchParams({ page: String(page) });
    if (platform) query.set("platform", platform);

    apiClient
      .get<DiscoverGamesResponse>(`/api/games/discover?${query}`)
      .then((data) => {
        if (cancelled) return;
        setResults((current) => (page === 1 ? data.results : [...current, ...data.results]));
        setHasMore(data.hasMore);
        setStatus("idle");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [page, platform]);

  return (
    <div className={styles.page}>
      <h1>Descobrir jogos</h1>
      <MediaSearchInput
        sectionPath="/jogos"
        placeholder="Nome do jogo..."
        ariaLabel="Buscar jogos"
      />

      <div className={styles.platformFilters} role="group" aria-label="Filtrar por plataforma">
        <button
          type="button"
          className={styles.platformChip}
          aria-pressed={platform === null}
          onClick={() => selectPlatform(null)}
        >
          Todas
        </button>
        {GAME_DISCOVER_PLATFORMS.map((option) => (
          <button
            key={option}
            type="button"
            className={styles.platformChip}
            aria-pressed={platform === option}
            onClick={() => selectPlatform(option)}
          >
            {GAME_DISCOVER_PLATFORM_LABELS[option]}
          </button>
        ))}
      </div>

      {status === "error" && (
        <p role="alert">Falha ao carregar jogos aclamados. Tente novamente.</p>
      )}

      <div className={styles.grid}>
        {results.map((game) => (
          <GameCard key={game.igdbId} game={game} entry={game.entry} interactive />
        ))}
      </div>

      {status === "loading" && <p className={styles.hint}>Carregando...</p>}

      {hasMore && status !== "loading" && (
        <div className={styles.loadMore}>
          <button type="button" onClick={() => setPage((current) => current + 1)}>
            Carregar mais
          </button>
        </div>
      )}
    </div>
  );
}

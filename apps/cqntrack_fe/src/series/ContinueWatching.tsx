import type { ContinueWatchingItem, ContinueWatchingResponse } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { apiClient } from "../lib/api-client";
import { useInfiniteScrollSentinel } from "../lib/useInfiniteScrollSentinel";
import styles from "./ContinueWatching.module.css";

type LoadStatus = "loading" | "ready" | "error";

// "YYYY-MM-DD" -> "DD/MM/YYYY", sem passar por Date (evita o bug de fuso:
// new Date("YYYY-MM-DD") vira meia-noite UTC, e toLocaleDateString num
// fuso atrás de UTC — caso do Brasil — mostraria o dia anterior).
function formatFullDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

// Seção principal da Home — séries com episódio pendente de verdade,
// calculado ao vivo (ver continue-watching.service.ts). Rolagem infinita:
// `cursor` null = não há mais página; carrega a próxima assim que o
// sentinela no fim da lista entra na viewport.
export function ContinueWatching() {
  const [items, setItems] = useState<ContinueWatchingItem[]>([]);
  const [cursor, setCursor] = useState<number | null>(0);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let cancelled = false;

    apiClient
      .get<ContinueWatchingResponse>("/api/series/continue-watching")
      .then((res) => {
        if (!cancelled) {
          setItems(res.items);
          setCursor(res.nextCursor);
          setLoadStatus("ready");
        }
      })
      .catch(() => {
        if (!cancelled) setLoadStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function loadMore() {
    if (cursor === null) return;
    setLoadingMore(true);
    try {
      const res = await apiClient.get<ContinueWatchingResponse>(
        `/api/series/continue-watching?cursor=${cursor}`,
      );
      setItems((current) => [...current, ...res.items]);
      setCursor(res.nextCursor);
    } catch {
      // Silencioso — o sentinela continua visível, tenta de novo assim que
      // reabilitar (ver `enabled` abaixo).
    } finally {
      setLoadingMore(false);
    }
  }

  const sentinelRef = useInfiniteScrollSentinel(
    loadMore,
    loadStatus === "ready" && cursor !== null && !loadingMore,
  );

  if (loadStatus === "loading") {
    return <p className={styles.hint}>Carregando...</p>;
  }
  if (loadStatus === "error") {
    return <p role="alert">Falha ao carregar as séries em andamento.</p>;
  }
  if (items.length === 0) {
    return <p className={styles.hint}>Nenhum episódio pendente — tudo em dia!</p>;
  }

  return (
    <>
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.series.tmdbId} className={styles.item}>
            <Link
              to={`/series/${item.series.tmdbId}/temporadas/${item.nextEpisode.seasonNumber}/episodios/${item.nextEpisode.episodeNumber}`}
              className={styles.link}
            >
              {item.series.posterUrl ? (
                <img className={styles.cover} src={item.series.posterUrl} alt="" loading="lazy" />
              ) : (
                <div className={styles.coverPlaceholder} aria-hidden="true" />
              )}
              <div>
                <p className={styles.name}>{item.series.name}</p>
                <p className={styles.episode}>
                  Temporada {item.nextEpisode.seasonNumber} · Episódio{" "}
                  {item.nextEpisode.episodeNumber}
                  {" — "}
                  {item.nextEpisode.name}
                </p>
                <p className={styles.date}>Lançado em {formatFullDate(item.nextEpisode.airDate)}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {cursor !== null && (
        <div ref={sentinelRef} className={styles.sentinel}>
          {loadingMore && <p className={styles.hint}>Carregando mais...</p>}
        </div>
      )}
    </>
  );
}

import type { ContinueWatchingResponse } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { apiClient } from "../lib/api-client";
import styles from "./ContinueWatching.module.css";

type LoadStatus = "loading" | "ready" | "error";

// Mesma conversão "YYYY-MM-DD" -> "DD/MM" de SeriesCard, sem passar por
// Date (evita o bug de fuso: new Date("YYYY-MM-DD") vira meia-noite UTC).
function formatShortDate(isoDate: string): string {
  const [, month, day] = isoDate.split("-");
  return `${day}/${month}`;
}

// Seção principal da Home — séries com episódio pendente de verdade (ver
// series_watch_progress, calculado pelo cron em refresh-episodes.job.ts).
// Já vem ordenada e filtrada pelo backend (getContinueWatching); aqui é só
// renderizar.
export function ContinueWatching() {
  const [data, setData] = useState<ContinueWatchingResponse | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");

  useEffect(() => {
    let cancelled = false;

    apiClient
      .get<ContinueWatchingResponse>("/api/series/continue-watching")
      .then((res) => {
        if (!cancelled) {
          setData(res);
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

  if (loadStatus === "loading") {
    return <p className={styles.hint}>Carregando...</p>;
  }
  if (loadStatus === "error") {
    return <p role="alert">Falha ao carregar as séries em andamento.</p>;
  }
  if (!data || data.items.length === 0) {
    return <p className={styles.hint}>Nenhum episódio pendente — tudo em dia!</p>;
  }

  return (
    <ul className={styles.list}>
      {data.items.map((item) => (
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
              <p className={styles.date}>Lançado em {formatShortDate(item.nextEpisode.airDate)}</p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

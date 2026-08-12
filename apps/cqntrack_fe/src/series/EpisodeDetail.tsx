import type { SeriesEpisodeDetail } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { CrewList } from "../components/CrewList";
import { ApiError, apiClient } from "../lib/api-client";
import styles from "./EpisodeDetail.module.css";

type LoadStatus = "loading" | "ready" | "not-found" | "error";

function formatRuntime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) {
    return `${mins}min`;
  }
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}min`;
}

export function EpisodeDetail() {
  const { tmdbId, seasonNumber, episodeNumber } = useParams<{
    tmdbId: string;
    seasonNumber: string;
    episodeNumber: string;
  }>();
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [episode, setEpisode] = useState<SeriesEpisodeDetail | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Reseta o status assim que os params da rota mudam (ex.: navegou de um
  // episódio pro próximo) — mesmo padrão de MovieDetail/SeriesDetail pro
  // :tmdbId, aqui aplicado aos três params juntos.
  const routeKey = `${tmdbId}/${seasonNumber}/${episodeNumber}`;
  const [trackedRouteKey, setTrackedRouteKey] = useState(routeKey);
  if (routeKey !== trackedRouteKey) {
    setTrackedRouteKey(routeKey);
    setLoadStatus("loading");
  }

  useEffect(() => {
    let cancelled = false;

    apiClient
      .get<SeriesEpisodeDetail>(`/api/series/${tmdbId}/episodes/${seasonNumber}/${episodeNumber}`)
      .then((data) => {
        if (cancelled) return;
        setEpisode(data);
        setLoadStatus("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadStatus(error instanceof ApiError && error.status === 404 ? "not-found" : "error");
      });

    return () => {
      cancelled = true;
    };
  }, [tmdbId, seasonNumber, episodeNumber]);

  async function toggleWatched() {
    if (!episode) return;
    const nextWatched = !episode.watched;
    setActionError(null);
    setEpisode({ ...episode, watched: nextWatched });
    try {
      await apiClient.put(`/api/series/${tmdbId}/episodes/${seasonNumber}/${episodeNumber}`, {
        watched: nextWatched,
      });
    } catch {
      setActionError("Falha ao salvar. Tente novamente.");
      setEpisode({ ...episode, watched: !nextWatched });
    }
  }

  if (loadStatus === "loading") {
    return <p>Carregando...</p>;
  }
  if (loadStatus === "not-found") {
    return <p>Episódio não encontrado.</p>;
  }
  if (loadStatus === "error" || !episode) {
    return <p role="alert">Falha ao carregar o episódio. Tente novamente.</p>;
  }

  return (
    <div className={styles.page}>
      <Link to={`/series/${tmdbId}`} className={styles.backLink}>
        ← Voltar pra série
      </Link>

      <div className={styles.header}>
        {episode.stillUrl ? (
          <img className={styles.still} src={episode.stillUrl} alt="" />
        ) : (
          <div className={styles.stillPlaceholder} aria-hidden="true" />
        )}
        <div>
          <p className={styles.eyebrow}>
            Temporada {episode.seasonNumber} · Episódio {episode.episodeNumber}
          </p>
          <h1>{episode.name}</h1>

          <div className={styles.metaRow}>
            {episode.airDate && <span className={styles.metaBadge}>{episode.airDate}</span>}
            {episode.rating !== null && (
              <span className={styles.metaBadge}>★ {episode.rating.toFixed(1)}</span>
            )}
            {episode.runtime !== null && (
              <span className={styles.metaBadge}>{formatRuntime(episode.runtime)}</span>
            )}
          </div>

          {episode.overview && <p className={styles.summary}>{episode.overview}</p>}
        </div>
      </div>

      <CrewList title="Direção" crew={episode.directors} />

      <section className={styles.entrySection}>
        {actionError && <p role="alert">{actionError}</p>}
        <button
          type="button"
          className={styles.watchedBtn}
          aria-pressed={episode.watched}
          onClick={toggleWatched}
        >
          {episode.watched ? "Desmarcar assistido" : "Marcar como assistido"}
        </button>
      </section>
    </div>
  );
}

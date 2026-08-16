import type { MovieDetailResponse, MovieEntry, UpsertMovieEntryRequest } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { CastList } from "../components/CastList";
import { CrewList } from "../components/CrewList";
import { StarRating } from "../components/StarRating";
import { ApiError, apiClient } from "../lib/api-client";
import { AddToMovieListMenu } from "./AddToMovieListMenu";
import styles from "./MovieDetail.module.css";
import { MovieStatusBadge } from "./MovieStatusBadge";

type LoadStatus = "loading" | "ready" | "not-found" | "error";

function formatRuntime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) {
    return `${mins}min`;
  }
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}min`;
}

function formatWatchedDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function MovieDetail() {
  const { tmdbId } = useParams<{ tmdbId: string }>();
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [detail, setDetail] = useState<MovieDetailResponse | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [reviewDraft, setReviewDraft] = useState("");

  // Reseta o status assim que o :tmdbId da rota muda — feito durante o
  // render (padrão do React pra "adjusting state when props change"), pra
  // deixar o efeito abaixo só com a chamada assíncrona em si.
  const [trackedTmdbId, setTrackedTmdbId] = useState(tmdbId);
  if (tmdbId !== trackedTmdbId) {
    setTrackedTmdbId(tmdbId);
    setLoadStatus("loading");
  }

  useEffect(() => {
    let cancelled = false;

    apiClient
      .get<MovieDetailResponse>(`/api/movies/${tmdbId}`)
      .then((data) => {
        if (cancelled) return;
        setDetail(data);
        setReviewDraft(data.entry?.review ?? "");
        setLoadStatus("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadStatus(error instanceof ApiError && error.status === 404 ? "not-found" : "error");
      });

    return () => {
      cancelled = true;
    };
  }, [tmdbId]);

  async function savePatch(patch: UpsertMovieEntryRequest) {
    setSaveError(null);
    try {
      const entry = await apiClient.put<MovieEntry>(`/api/movies/${tmdbId}/entry`, patch);
      setDetail((current) => (current ? { ...current, entry } : current));
    } catch {
      setSaveError("Falha ao salvar sua marcação. Tente novamente.");
    }
  }

  async function removeEntry() {
    setSaveError(null);
    try {
      await apiClient.delete(`/api/movies/${tmdbId}/entry`);
      setDetail((current) => (current ? { ...current, entry: null } : current));
      setReviewDraft("");
    } catch {
      setSaveError("Falha ao remover a marcação. Tente novamente.");
    }
  }

  if (loadStatus === "loading") {
    return <p>Carregando...</p>;
  }
  if (loadStatus === "not-found") {
    return <p>Filme não encontrado.</p>;
  }
  if (loadStatus === "error" || !detail) {
    return <p role="alert">Falha ao carregar o filme. Tente novamente.</p>;
  }

  const { movie, entry } = detail;
  const year = movie.releaseDate ? movie.releaseDate.slice(0, 4) : null;
  const favorited = entry?.favoritedAt != null;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        {movie.posterUrl && <img className={styles.cover} src={movie.posterUrl} alt="" />}
        <div>
          <h1>{movie.name}</h1>

          <div className={styles.metaRow}>
            {year && <span className={styles.metaBadge}>{year}</span>}
            {movie.rating !== null && (
              <span className={styles.metaBadge}>★ {movie.rating.toFixed(1)}</span>
            )}
            {movie.runtime !== null && (
              <span className={styles.metaBadge}>{formatRuntime(movie.runtime)}</span>
            )}
          </div>

          {movie.genres.length > 0 && (
            <div className={styles.tagRow}>
              {movie.genres.map((genre) => (
                <span key={genre} className={styles.genreTag}>
                  {genre}
                </span>
              ))}
            </div>
          )}

          {movie.overview && <p className={styles.summary}>{movie.overview}</p>}
        </div>
      </div>

      <CrewList title="Direção" crew={movie.directors} />
      <CastList title="Elenco" cast={movie.cast} />

      <section className={styles.entrySection}>
        <h2>Sua marcação</h2>
        {saveError && <p role="alert">{saveError}</p>}

        <AddToMovieListMenu tmdbId={movie.tmdbId} />

        <div className={styles.watchedRow}>
          <button
            type="button"
            className={styles.favoriteBtn}
            aria-pressed={favorited}
            aria-label={favorited ? "Desfavoritar" : "Favoritar"}
            onClick={() => savePatch({ favorited: !favorited })}
          >
            {favorited ? "♥" : "♡"}
          </button>
          <StarRating value={entry?.rating ?? null} onChange={(rating) => savePatch({ rating })} />
        </div>

        <div className={styles.watchedRow}>
          <MovieStatusBadge
            status={entry?.status ?? null}
            onChange={(status) => savePatch({ status })}
          />
          {entry?.watchedAt && (
            <span className={styles.watchedDate}>
              Assistido em {formatWatchedDate(entry.watchedAt)}
            </span>
          )}
        </div>

        <label className={styles.field}>
          <span>Review</span>
          <textarea
            value={reviewDraft}
            maxLength={2000}
            rows={4}
            onChange={(event) => setReviewDraft(event.target.value)}
            onBlur={() => {
              if (reviewDraft !== (entry?.review ?? "")) {
                savePatch({ review: reviewDraft || null });
              }
            }}
          />
        </label>

        {entry && (
          <button type="button" className={styles.removeBtn} onClick={removeEntry}>
            Remover marcação
          </button>
        )}
      </section>
    </div>
  );
}

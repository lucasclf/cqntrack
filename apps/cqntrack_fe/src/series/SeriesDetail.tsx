import type { SeriesDetailResponse, SeriesEntry, UpsertSeriesEntryRequest } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { StarRating } from "../components/StarRating";
import { ApiError, apiClient } from "../lib/api-client";
import styles from "./SeriesDetail.module.css";
import { SeriesStatusBadge } from "./SeriesStatusBadge";

type LoadStatus = "loading" | "ready" | "not-found" | "error";

export function SeriesDetail() {
  const { tmdbId } = useParams<{ tmdbId: string }>();
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [detail, setDetail] = useState<SeriesDetailResponse | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [seasonDraft, setSeasonDraft] = useState("");
  const [episodeDraft, setEpisodeDraft] = useState("");
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
      .get<SeriesDetailResponse>(`/api/series/${tmdbId}`)
      .then((data) => {
        if (cancelled) return;
        setDetail(data);
        setSeasonDraft(data.entry?.currentSeason != null ? String(data.entry.currentSeason) : "");
        setEpisodeDraft(data.entry?.currentEpisode != null ? String(data.entry.currentEpisode) : "");
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

  async function savePatch(patch: UpsertSeriesEntryRequest) {
    setSaveError(null);
    try {
      const entry = await apiClient.put<SeriesEntry>(`/api/series/${tmdbId}/entry`, patch);
      setDetail((current) => (current ? { ...current, entry } : current));
    } catch {
      setSaveError("Falha ao salvar sua marcação. Tente novamente.");
    }
  }

  // Temporada e episódio sempre são enviados juntos (mesmo quando só um dos
  // dois campos mudou) — evita que a atividade "progress_updated" registre
  // um valor incoerente com o que de fato ficou salvo.
  function saveProgress() {
    const season = seasonDraft ? Number(seasonDraft) : null;
    const episode = episodeDraft ? Number(episodeDraft) : null;
    const currentSeason = detail?.entry?.currentSeason ?? null;
    const currentEpisode = detail?.entry?.currentEpisode ?? null;
    if (season === currentSeason && episode === currentEpisode) {
      return;
    }
    savePatch({ currentSeason: season, currentEpisode: episode });
  }

  async function removeEntry() {
    setSaveError(null);
    try {
      await apiClient.delete(`/api/series/${tmdbId}/entry`);
      setDetail((current) => (current ? { ...current, entry: null } : current));
      setSeasonDraft("");
      setEpisodeDraft("");
      setReviewDraft("");
    } catch {
      setSaveError("Falha ao remover a marcação. Tente novamente.");
    }
  }

  if (loadStatus === "loading") {
    return <p>Carregando...</p>;
  }
  if (loadStatus === "not-found") {
    return <p>Série não encontrada.</p>;
  }
  if (loadStatus === "error" || !detail) {
    return <p role="alert">Falha ao carregar a série. Tente novamente.</p>;
  }

  const { series, entry } = detail;
  const year = series.firstAirDate ? series.firstAirDate.slice(0, 4) : null;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        {series.posterUrl && <img className={styles.cover} src={series.posterUrl} alt="" />}
        <div>
          <h1>{series.name}</h1>

          <div className={styles.metaRow}>
            {year && <span className={styles.metaBadge}>{year}</span>}
            {series.rating !== null && (
              <span className={styles.metaBadge}>★ {series.rating.toFixed(1)}</span>
            )}
            {series.numberOfSeasons !== null && (
              <span className={styles.metaBadge}>
                {series.numberOfSeasons} temporada{series.numberOfSeasons === 1 ? "" : "s"}
              </span>
            )}
          </div>

          {series.genres.length > 0 && (
            <div className={styles.tagRow}>
              {series.genres.map((genre) => (
                <span key={genre} className={styles.genreTag}>
                  {genre}
                </span>
              ))}
            </div>
          )}

          {series.overview && <p className={styles.summary}>{series.overview}</p>}
        </div>
      </div>

      <section className={styles.entrySection}>
        <h2>Sua marcação</h2>
        {saveError && <p role="alert">{saveError}</p>}

        <SeriesStatusBadge status={entry?.status ?? null} onChange={(status) => savePatch({ status })} />

        <StarRating value={entry?.rating ?? null} onChange={(rating) => savePatch({ rating })} />

        <fieldset className={styles.field}>
          <legend>Progresso</legend>
          <div className={styles.progressRow}>
            <label className={styles.progressField}>
              <span>Temporada</span>
              <input
                type="number"
                min={1}
                value={seasonDraft}
                onChange={(event) => setSeasonDraft(event.target.value)}
                onBlur={saveProgress}
              />
            </label>
            <label className={styles.progressField}>
              <span>Episódio</span>
              <input
                type="number"
                min={1}
                value={episodeDraft}
                onChange={(event) => setEpisodeDraft(event.target.value)}
                onBlur={saveProgress}
              />
            </label>
          </div>
          {series.numberOfSeasons !== null && series.numberOfEpisodes !== null && (
            <p className={styles.hint}>
              de {series.numberOfSeasons} temporada{series.numberOfSeasons === 1 ? "" : "s"} e{" "}
              {series.numberOfEpisodes} episódios ao todo
            </p>
          )}
        </fieldset>

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

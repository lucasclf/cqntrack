import type {
  SeriesDetailResponse,
  SeriesEntry,
  SeriesSeasonEpisodesResponse,
  UpsertSeriesEntryRequest,
} from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { CastList } from "../components/CastList";
import { CrewList } from "../components/CrewList";
import { StarRating } from "../components/StarRating";
import { ApiError, apiClient } from "../lib/api-client";
import { AddToSeriesListMenu } from "./AddToSeriesListMenu";
import styles from "./SeriesDetail.module.css";
import { SeriesEpisodeList } from "./SeriesEpisodeList";

type LoadStatus = "loading" | "ready" | "not-found" | "error";

export function SeriesDetail() {
  const { tmdbId } = useParams<{ tmdbId: string }>();
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [detail, setDetail] = useState<SeriesDetailResponse | null>(null);
  // Temporada 1 buscada junto do detalhe (em paralelo, não em sequência) —
  // assim, quando a página aparece, a lista de episódios já chega pronta,
  // sem um segundo "carregando" logo depois do primeiro. null quando a
  // série não tem Temporada 1 (aí SeriesEpisodeList busca o padrão sozinho).
  const [initialSeasonData, setInitialSeasonData] = useState<SeriesSeasonEpisodesResponse | null>(
    null,
  );
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

    Promise.all([
      apiClient.get<SeriesDetailResponse>(`/api/series/${tmdbId}`),
      apiClient
        .get<SeriesSeasonEpisodesResponse>(`/api/series/${tmdbId}/seasons/1`)
        .catch(() => null),
    ])
      .then(([data, season1]) => {
        if (cancelled) return;
        setDetail(data);
        setInitialSeasonData(season1);
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

  async function removeEntry() {
    setSaveError(null);
    try {
      await apiClient.delete(`/api/series/${tmdbId}/entry`);
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

      <CrewList title="Criado por" crew={series.creators} />
      <CrewList title="Direção" crew={series.directors} />
      <CastList title="Elenco" cast={series.cast} />

      <section className={styles.entrySection}>
        <h2>Sua marcação</h2>
        {saveError && <p role="alert">{saveError}</p>}

        <AddToSeriesListMenu tmdbId={series.tmdbId} />

        <StarRating value={entry?.rating ?? null} onChange={(rating) => savePatch({ rating })} />

        {entry && (
          <button type="button" className={styles.removeBtn} onClick={removeEntry}>
            Remover marcação
          </button>
        )}
      </section>

      <SeriesEpisodeList
        tmdbId={series.tmdbId}
        seasons={series.seasons ?? []}
        initialSeasonData={initialSeasonData}
      />

      <section className={styles.entrySection}>
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
      </section>
    </div>
  );
}

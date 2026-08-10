import type { GameDetailResponse, GameEntry, UpsertGameEntryRequest } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { GamesApiError, gamesClient } from "../lib/games-client";
import { AddToListMenu } from "./AddToListMenu";
import styles from "./GameDetail.module.css";
import { StarRating } from "./StarRating";
import { StatusBadge } from "./StatusBadge";

type LoadStatus = "loading" | "ready" | "not-found" | "error";

export function GameDetail() {
  const { igdbId } = useParams<{ igdbId: string }>();
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [detail, setDetail] = useState<GameDetailResponse | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [platformsDraft, setPlatformsDraft] = useState<string[]>([]);
  const [reviewDraft, setReviewDraft] = useState("");

  // Reseta o status assim que o :igdbId da rota muda — feito durante o
  // render (padrão do React pra "adjusting state when props change"), pra
  // deixar o efeito abaixo só com a chamada assíncrona em si.
  const [trackedIgdbId, setTrackedIgdbId] = useState(igdbId);
  if (igdbId !== trackedIgdbId) {
    setTrackedIgdbId(igdbId);
    setLoadStatus("loading");
  }

  useEffect(() => {
    let cancelled = false;

    gamesClient
      .get<GameDetailResponse>(`/api/games/${igdbId}`)
      .then((data) => {
        if (cancelled) return;
        setDetail(data);
        setPlatformsDraft(data.entry?.platforms ?? []);
        setReviewDraft(data.entry?.review ?? "");
        setLoadStatus("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadStatus(error instanceof GamesApiError && error.status === 404 ? "not-found" : "error");
      });

    return () => {
      cancelled = true;
    };
  }, [igdbId]);

  async function savePatch(patch: UpsertGameEntryRequest) {
    setSaveError(null);
    try {
      const entry = await gamesClient.put<GameEntry>(`/api/games/${igdbId}/entry`, patch);
      setDetail((current) => (current ? { ...current, entry } : current));
    } catch {
      setSaveError("Falha ao salvar sua marcação. Tente novamente.");
    }
  }

  function togglePlatform(platform: string) {
    const next = platformsDraft.includes(platform)
      ? platformsDraft.filter((current) => current !== platform)
      : [...platformsDraft, platform];
    setPlatformsDraft(next);
    savePatch({ platforms: next.length > 0 ? next : null });
  }

  async function removeEntry() {
    setSaveError(null);
    try {
      await gamesClient.delete(`/api/games/${igdbId}/entry`);
      setDetail((current) => (current ? { ...current, entry: null } : current));
      setPlatformsDraft([]);
      setReviewDraft("");
    } catch {
      setSaveError("Falha ao remover a marcação. Tente novamente.");
    }
  }

  if (loadStatus === "loading") {
    return <p>Carregando...</p>;
  }
  if (loadStatus === "not-found") {
    return <p>Jogo não encontrado.</p>;
  }
  if (loadStatus === "error" || !detail) {
    return <p role="alert">Falha ao carregar o jogo. Tente novamente.</p>;
  }

  const { game, entry } = detail;
  const year = game.firstReleaseDate ? game.firstReleaseDate.slice(0, 4) : null;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        {game.coverUrl && <img className={styles.cover} src={game.coverUrl} alt="" />}
        <div>
          <h1>{game.name}</h1>

          <div className={styles.metaRow}>
            {year && <span className={styles.metaBadge}>{year}</span>}
            {game.rating !== null && (
              <span className={styles.metaBadge}>★ {Math.round(game.rating)}</span>
            )}
          </div>

          {game.platforms.length > 0 && (
            <div className={styles.tagRow}>
              {game.platforms.map((platform) => (
                <span key={platform} className={styles.platformTag}>
                  {platform}
                </span>
              ))}
            </div>
          )}

          {game.genres.length > 0 && (
            <div className={styles.tagRow}>
              {game.genres.map((genre) => (
                <span key={genre} className={styles.genreTag}>
                  {genre}
                </span>
              ))}
            </div>
          )}

          {game.summary && <p className={styles.summary}>{game.summary}</p>}
        </div>
      </div>

      <section className={styles.entrySection}>
        <h2>Sua marcação</h2>
        {saveError && <p role="alert">{saveError}</p>}

        <StatusBadge status={entry?.status ?? null} onChange={(status) => savePatch({ status })} />

        <AddToListMenu igdbId={game.igdbId} />

        <StarRating value={entry?.rating ?? null} onChange={(rating) => savePatch({ rating })} />

        <fieldset className={styles.field}>
          <legend>Plataformas jogadas</legend>
          {game.platforms.length === 0 && (
            <p className={styles.hint}>Plataforma não informada pela IGDB.</p>
          )}
          <div className={styles.platformOptions}>
            {game.platforms.map((platform) => (
              <label key={platform} className={styles.platformOption}>
                <input
                  type="checkbox"
                  checked={platformsDraft.includes(platform)}
                  onChange={() => togglePlatform(platform)}
                />
                <span>{platform}</span>
              </label>
            ))}
          </div>
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

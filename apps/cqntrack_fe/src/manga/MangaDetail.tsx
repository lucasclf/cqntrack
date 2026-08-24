import {
  MANGA_PUBLICATION_STATUSES,
  type MangaDetailResponse,
  type MangaEntry,
  type UpsertMangaEntryRequest,
} from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { BackButton } from "../components/BackButton";
import { StarRating } from "../components/StarRating";
import { ApiError, apiClient } from "../lib/api-client";
import { AddToMangaListMenu } from "./AddToMangaListMenu";
import { MangaStatusBadge } from "./MangaStatusBadge";
import { MangaVolumeList } from "./MangaVolumeList";
import styles from "./MangaDetail.module.css";

type LoadStatus = "loading" | "ready" | "not-found" | "error";

const PUBLICATION_STATUS_LABELS: Record<(typeof MANGA_PUBLICATION_STATUSES)[number], string> = {
  ongoing: "Em lançamento",
  completed: "Completo",
  hiatus: "Em hiato",
  cancelled: "Cancelado",
};

export function MangaDetail() {
  const { mangadexId } = useParams<{ mangadexId: string }>();
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [detail, setDetail] = useState<MangaDetailResponse | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [reviewDraft, setReviewDraft] = useState("");

  // Reseta o status assim que o :mangadexId da rota muda — feito durante o
  // render (padrão do React pra "adjusting state when props change"), pra
  // deixar o efeito abaixo só com a chamada assíncrona em si.
  const [trackedMangadexId, setTrackedMangadexId] = useState(mangadexId);
  if (mangadexId !== trackedMangadexId) {
    setTrackedMangadexId(mangadexId);
    setLoadStatus("loading");
  }

  useEffect(() => {
    let cancelled = false;

    apiClient
      .get<MangaDetailResponse>(`/api/manga/${mangadexId}`)
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
  }, [mangadexId]);

  async function savePatch(patch: UpsertMangaEntryRequest) {
    setSaveError(null);
    try {
      const entry = await apiClient.put<MangaEntry>(`/api/manga/${mangadexId}/entry`, patch);
      setDetail((current) => (current ? { ...current, entry } : current));
    } catch {
      setSaveError("Falha ao salvar sua marcação. Tente novamente.");
    }
  }

  async function removeEntry() {
    setSaveError(null);
    try {
      await apiClient.delete(`/api/manga/${mangadexId}/entry`);
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
    return <p>Mangá não encontrado.</p>;
  }
  if (loadStatus === "error" || !detail || !mangadexId) {
    return <p role="alert">Falha ao carregar o mangá. Tente novamente.</p>;
  }

  const { manga, entry } = detail;
  const favorited = entry?.favoritedAt != null;

  return (
    <div className={styles.page}>
      <BackButton />
      <div className={styles.header}>
        {manga.coverUrl && <img className={styles.cover} src={manga.coverUrl} alt="" />}
        <div>
          <h1>{manga.title}</h1>

          {manga.authors.length > 0 && (
            <p className={styles.summary}>
              {manga.authors.map((author, index) => (
                <span key={author.id}>
                  {index > 0 && ", "}
                  <Link to={`/mangas/autores/${author.id}`}>{author.name}</Link>
                </span>
              ))}
            </p>
          )}

          <div className={styles.metaRow}>
            {manga.year && <span className={styles.metaBadge}>{manga.year}</span>}
            {manga.publicationStatus && (
              <span className={styles.metaBadge}>
                {PUBLICATION_STATUS_LABELS[manga.publicationStatus]}
              </span>
            )}
          </div>

          {manga.tags.length > 0 && (
            <div className={styles.tagRow}>
              {manga.tags.map((tag) => (
                <span key={tag} className={styles.genreTag}>
                  {tag}
                </span>
              ))}
            </div>
          )}

          {manga.description && <p className={styles.summary}>{manga.description}</p>}
        </div>
      </div>

      <section className={styles.entrySection}>
        <h2>Sua marcação</h2>
        {saveError && <p role="alert">{saveError}</p>}

        <MangaStatusBadge
          status={entry?.status ?? null}
          onChange={(status) => savePatch({ status })}
        />

        <AddToMangaListMenu mangadexId={mangadexId} />

        <div className={styles.favoriteRow}>
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

      <MangaVolumeList mangadexId={mangadexId} />
    </div>
  );
}

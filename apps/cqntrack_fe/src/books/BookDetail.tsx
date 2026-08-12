import type { BookDetailResponse, BookEntry, UpsertBookEntryRequest } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { StarRating } from "../components/StarRating";
import { ApiError, apiClient } from "../lib/api-client";
import { AddToBookListMenu } from "./AddToBookListMenu";
import { BookStatusBadge } from "./BookStatusBadge";
import styles from "./BookDetail.module.css";

type LoadStatus = "loading" | "ready" | "not-found" | "error";

export function BookDetail() {
  const { googleBooksId } = useParams<{ googleBooksId: string }>();
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [detail, setDetail] = useState<BookDetailResponse | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [reviewDraft, setReviewDraft] = useState("");

  // Reseta o status assim que o :googleBooksId da rota muda — feito durante
  // o render (padrão do React pra "adjusting state when props change"), pra
  // deixar o efeito abaixo só com a chamada assíncrona em si.
  const [trackedGoogleBooksId, setTrackedGoogleBooksId] = useState(googleBooksId);
  if (googleBooksId !== trackedGoogleBooksId) {
    setTrackedGoogleBooksId(googleBooksId);
    setLoadStatus("loading");
  }

  useEffect(() => {
    let cancelled = false;

    apiClient
      .get<BookDetailResponse>(`/api/books/${googleBooksId}`)
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
  }, [googleBooksId]);

  async function savePatch(patch: UpsertBookEntryRequest) {
    setSaveError(null);
    try {
      const entry = await apiClient.put<BookEntry>(`/api/books/${googleBooksId}/entry`, patch);
      setDetail((current) => (current ? { ...current, entry } : current));
    } catch {
      setSaveError("Falha ao salvar sua marcação. Tente novamente.");
    }
  }

  async function removeEntry() {
    setSaveError(null);
    try {
      await apiClient.delete(`/api/books/${googleBooksId}/entry`);
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
    return <p>Livro não encontrado.</p>;
  }
  if (loadStatus === "error" || !detail) {
    return <p role="alert">Falha ao carregar o livro. Tente novamente.</p>;
  }

  const { book, entry } = detail;
  const year = book.publishedDate ? book.publishedDate.slice(0, 4) : null;
  const favorited = entry?.favoritedAt != null;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        {book.coverUrl && <img className={styles.cover} src={book.coverUrl} alt="" />}
        <div>
          <h1>{book.title}</h1>

          {book.authors.length > 0 && (
            <p className={styles.summary}>
              {book.authors.map((author, index) => (
                <span key={author}>
                  {index > 0 && ", "}
                  <Link to={`/livros/autores/${encodeURIComponent(author)}`}>{author}</Link>
                </span>
              ))}
            </p>
          )}

          <div className={styles.metaRow}>
            {year && <span className={styles.metaBadge}>{year}</span>}
            {book.rating !== null && (
              <span className={styles.metaBadge}>★ {book.rating.toFixed(1)}</span>
            )}
            {book.pageCount !== null && (
              <span className={styles.metaBadge}>{book.pageCount} páginas</span>
            )}
          </div>

          {book.categories.length > 0 && (
            <div className={styles.tagRow}>
              {book.categories.map((category) => (
                <span key={category} className={styles.genreTag}>
                  {category}
                </span>
              ))}
            </div>
          )}

          {book.description && <p className={styles.summary}>{book.description}</p>}
        </div>
      </div>

      <section className={styles.entrySection}>
        <h2>Sua marcação</h2>
        {saveError && <p role="alert">{saveError}</p>}

        <BookStatusBadge status={entry?.status ?? null} onChange={(status) => savePatch({ status })} />

        <AddToBookListMenu googleBooksId={book.googleBooksId} />

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
    </div>
  );
}

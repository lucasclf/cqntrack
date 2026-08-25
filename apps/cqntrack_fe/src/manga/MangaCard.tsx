import { MANGA_STATUS_LABELS, type MangaEntry, type MangaSummary } from "@cqntrack/shared";
import { useContext, useState, type MouseEvent } from "react";
import { Link } from "react-router";
import { apiClient } from "../lib/api-client";
import { ConfirmContext } from "../lib/ConfirmDialogContext";
import styles from "./MangaCard.module.css";

interface MangaCardProps {
  manga: MangaSummary;
  // Presente nas telas que já sabem a marcação do usuário pro mangá
  // (marcações, listas, busca, descobrir, perfil) — null quando o mangá
  // nunca foi marcado, undefined nas raras telas que ainda não carregam
  // entry nenhuma.
  entry?: MangaEntry | null;
  // Ações rápidas (favoritar/marcar mangá inteiro como lido) só aparecem
  // quando true — nunca no perfil público de outra pessoa
  // (apps/cqntrack_fe/src/profile/* usa o Card sem essa prop de propósito).
  // Por isso o hook de confirmação é lido via useContext direto (não o
  // useConfirm() que lança erro sem provider) — mesmo racional de
  // SeriesCard: quando interactive é false este componente pode renderizar
  // fora do ConfirmDialogProvider (só montado no AppShell autenticado, não
  // no layout do perfil público) sem quebrar a página.
  interactive?: boolean;
}

function withPatch(current: MangaEntry | null, patch: Partial<MangaEntry>): MangaEntry {
  return {
    id: current?.id ?? "",
    status: current?.status ?? null,
    rating: current?.rating ?? null,
    readChapterCount: current?.readChapterCount ?? 0,
    favoritedAt: current?.favoritedAt ?? null,
    review: current?.review ?? null,
    updatedAt: current?.updatedAt ?? new Date().toISOString(),
    ...patch,
  };
}

// Cartão de mangá reutilizado em busca, descobrir, listas, marcações e
// perfil público — sempre linka pro detalhe (/mangas/:mangadexId). Card
// inteiro é um <Link>, então os botões de ação rápida precisam de
// preventDefault + stopPropagation pra não disparar a navegação junto do
// clique.
export function MangaCard({ manga, entry, interactive = false }: MangaCardProps) {
  const confirm = useContext(ConfirmContext);
  const extraAuthors = manga.authors.length - 1;

  // Estado local otimista pras ações rápidas — reverte se o PUT falhar (ou
  // fica com a aproximação otimista após read-all, ver markAllRead abaixo).
  // Ressincroniza quando a prop `entry` muda de verdade (ex.: grid
  // recarregado do zero), mesmo padrão "trackedX" já usado em
  // SeriesEpisodeList/MangaVolumeList.
  const [localEntry, setLocalEntry] = useState(entry ?? null);
  const [trackedEntry, setTrackedEntry] = useState(entry);
  if (entry !== trackedEntry) {
    setTrackedEntry(entry);
    setLocalEntry(entry ?? null);
  }
  const [markAllPending, setMarkAllPending] = useState(false);

  async function toggleFavorite(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    const wasFavorited = localEntry?.favoritedAt != null;
    const previous = localEntry;
    setLocalEntry(
      withPatch(localEntry, { favoritedAt: wasFavorited ? null : new Date().toISOString() }),
    );
    try {
      const updated = await apiClient.put<MangaEntry>(`/api/manga/${manga.mangadexId}/entry`, {
        favorited: !wasFavorited,
      });
      setLocalEntry(updated);
    } catch {
      setLocalEntry(previous);
    }
  }

  // Mangá tem status (diferente de série), mas "marcar" no Card dispara o
  // endpoint bulk da Fase 5 (read-all) com confirmação — mesma decisão de
  // produto de SeriesCard: marcar como lido deve significar "li os
  // capítulos", não só rotular o status. Sem "desmarcar": o endpoint bulk
  // só marca.
  async function markAllRead(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!confirm) return;
    if (!(await confirm("Marcar todos os capítulos deste mangá como lidos?"))) {
      return;
    }

    setMarkAllPending(true);
    try {
      await apiClient.put(`/api/manga/${manga.mangadexId}/read-all`);
      setLocalEntry((current) => withPatch(current, { status: "read" }));
    } catch {
      // Silencioso — o botão continua clicável pra tentar de novo.
    } finally {
      setMarkAllPending(false);
    }
  }

  const favorited = localEntry?.favoritedAt != null;

  return (
    <Link to={`/mangas/${manga.mangadexId}`} className={styles.card}>
      <div className={styles.coverWrap}>
        {manga.coverUrl ? (
          <img className={styles.cover} src={manga.coverUrl} alt="" loading="lazy" />
        ) : (
          <div className={styles.coverPlaceholder} aria-hidden="true" />
        )}
        {interactive ? (
          <button
            type="button"
            className={styles.favoriteButton}
            aria-pressed={favorited}
            aria-label={favorited ? "Desfavoritar" : "Favoritar"}
            onClick={toggleFavorite}
          >
            {favorited ? "♥" : "♡"}
          </button>
        ) : (
          favorited && (
            <span className={styles.favoriteBadge} aria-label="Favoritado">
              ♥
            </span>
          )
        )}
        {interactive && (
          <button
            type="button"
            className={styles.completeButton}
            disabled={markAllPending}
            aria-label="Marcar mangá inteiro como lido"
            onClick={markAllRead}
          >
            ✓
          </button>
        )}
      </div>
      <div className={styles.info}>
        <p className={styles.name}>{manga.title}</p>
        <p className={styles.meta}>
          {manga.year ?? "Ano desconhecido"}
          {manga.authors.length > 0 &&
            ` · ${manga.authors[0]?.name}${extraAuthors > 0 ? ` +${extraAuthors}` : ""}`}
        </p>
        {/* Sempre reserva a linha quando há entry, com status/nota ou vazia —
            senão os cards sem nenhum dos dois ficam mais baixos que os
            vizinhos que têm, quebrando o alinhamento da fileira no grid. */}
        {localEntry && (
          <p className={styles.entryMeta}>
            {localEntry.status && (
              <span className={styles.statusPill}>{MANGA_STATUS_LABELS[localEntry.status]}</span>
            )}
            {localEntry.rating !== null && (
              <span className={styles.personalRating}>★ {localEntry.rating.toFixed(1)}</span>
            )}
          </p>
        )}
      </div>
    </Link>
  );
}

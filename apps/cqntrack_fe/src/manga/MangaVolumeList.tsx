import type { MangaVolumesResponse } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { apiClient } from "../lib/api-client";
import { useConfirm } from "../lib/useConfirm";
import styles from "./MangaVolumeList.module.css";

interface MangaVolumeListProps {
  mangadexId: string;
}

// "Volume 0" é o sentinela de "sem volume atribuído" (capítulo avulso na
// MangaDex, ver manga.schema.ts no backend) — mostrado como "Avulsos" em
// vez de "Volume 0", que confundiria.
function volumeLabel(volumeNumber: number): string {
  return volumeNumber === 0 ? "Avulsos" : `Volume ${volumeNumber}`;
}

// Sentinela -1 pro capítulo (não o volume) sem número — ver
// chapters.service.ts no backend pro racional completo (a MangaDex usa
// "none" tanto pra volume quanto pra capítulo, cada um com seu próprio
// sentinela pra não colidir com um "Capítulo 0" de verdade).
function chapterLabel(chapterNumber: number): string {
  return chapterNumber === -1 ? "Extra" : `Capítulo ${chapterNumber}`;
}

// Lista de capítulos por volume, buscada ao vivo na MangaDex (sem cache
// local, mesmo espírito de SeriesEpisodeList/series.schema.ts) — só o
// "lido" é nosso. Diferente de série, a MangaDex devolve a estrutura
// inteira (todos os volumes/capítulos) numa chamada só (GET .../volumes,
// que já usa /aggregate por baixo) — sem precisar de cache por aba nem de
// um segundo fetch ao trocar de volume, tudo já está em memória depois do
// primeiro carregamento.
export function MangaVolumeList({ mangadexId }: MangaVolumeListProps) {
  const confirm = useConfirm();
  const [data, setData] = useState<MangaVolumesResponse | null>(null);
  const [selectedVolume, setSelectedVolume] = useState<number | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [volumeActionPending, setVolumeActionPending] = useState(false);
  const [allChaptersActionPending, setAllChaptersActionPending] = useState(false);

  // Troca de mangá (mesmo componente, :mangadexId da rota mudou sem
  // remontar) — ajustado durante o render (mesmo padrão de SeriesEpisodeList
  // pro :tmdbId).
  const [trackedMangadexId, setTrackedMangadexId] = useState(mangadexId);
  if (mangadexId !== trackedMangadexId) {
    setTrackedMangadexId(mangadexId);
    setData(null);
    setSelectedVolume(null);
    setLoadError(false);
  }

  useEffect(() => {
    let cancelled = false;

    apiClient
      .get<MangaVolumesResponse>(`/api/manga/${mangadexId}/volumes`)
      .then((response) => {
        if (cancelled) return;
        setData(response);
        setSelectedVolume((current) => current ?? response.volumes[0]?.volumeNumber ?? null);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [mangadexId]);

  function updateChapter(volumeNumber: number, chapterNumber: number, read: boolean) {
    setData((current) =>
      current
        ? {
            volumes: current.volumes.map((volume) =>
              volume.volumeNumber !== volumeNumber
                ? volume
                : {
                    ...volume,
                    chapters: volume.chapters.map((chapter) =>
                      chapter.chapterNumber === chapterNumber ? { ...chapter, read } : chapter,
                    ),
                  },
            ),
          }
        : current,
    );
  }

  // Otimista: atualiza a UI antes da resposta do PUT, reverte se falhar —
  // mesmo espírito de toggleEpisode em SeriesEpisodeList. Ao marcar (não ao
  // desmarcar) um capítulo, se há capítulo(s) anterior(es) do mesmo volume
  // ainda não lido(s), pergunta se quer marcar os anteriores junto.
  async function toggleChapter(volumeNumber: number, chapterNumber: number, read: boolean) {
    const volume = data?.volumes.find((item) => item.volumeNumber === volumeNumber);

    let chapterNumbersToMark = [chapterNumber];
    if (read && volume) {
      const earlierUnread = volume.chapters
        .filter((chapter) => chapter.chapterNumber < chapterNumber && !chapter.read)
        .map((chapter) => chapter.chapterNumber);
      if (
        earlierUnread.length > 0 &&
        (await confirm(
          earlierUnread.length === 1
            ? "Você ainda não marcou o capítulo anterior deste volume como lido. Marcar ele também?"
            : `Você ainda não marcou ${earlierUnread.length} capítulos anteriores deste volume como lidos. Marcar eles também?`,
        ))
      ) {
        chapterNumbersToMark = [...earlierUnread, chapterNumber];
      }
    }

    setActionError(null);
    for (const number of chapterNumbersToMark) {
      updateChapter(volumeNumber, number, read);
    }
    try {
      await Promise.all(
        chapterNumbersToMark.map((number) =>
          apiClient.put(`/api/manga/${mangadexId}/chapters/${volumeNumber}/${number}`, { read }),
        ),
      );
    } catch {
      setActionError("Falha ao salvar. Tente novamente.");
      for (const number of chapterNumbersToMark) {
        updateChapter(volumeNumber, number, !read);
      }
    }
  }

  async function toggleVolume() {
    if (selectedVolume === null) return;
    const volume = data?.volumes.find((item) => item.volumeNumber === selectedVolume);
    if (!volume) return;
    const allRead = volume.chapters.length > 0 && volume.chapters.every((chapter) => chapter.read);
    const nextRead = !allRead;
    if (!nextRead && !(await confirm("Desmarcar todos os capítulos deste volume?"))) {
      return;
    }

    setActionError(null);
    setVolumeActionPending(true);
    try {
      await apiClient.put(`/api/manga/${mangadexId}/volumes/${selectedVolume}`, { read: nextRead });
      setData((current) =>
        current
          ? {
              volumes: current.volumes.map((item) =>
                item.volumeNumber !== selectedVolume
                  ? item
                  : {
                      ...item,
                      chapters: item.chapters.map((chapter) => ({ ...chapter, read: nextRead })),
                    },
              ),
            }
          : current,
      );
    } catch {
      setActionError("Falha ao salvar. Tente novamente.");
    } finally {
      setVolumeActionPending(false);
    }
  }

  // Mangá inteiro de uma vez (item 5 do pedido do usuário) — diferente de
  // toggleVolume, não olha o estado atual pra decidir marcar/desmarcar (só
  // marca, não existe "desmarcar tudo" pedido). Como a MangaDex já devolve
  // a estrutura inteira numa chamada só (ver comentário no topo do
  // arquivo), dá pra atualizar todos os volumes em memória direto, sem
  // precisar invalidar e rebuscar (diferente de markAllSeasonsWatched, que
  // usa cache por temporada).
  async function markAllChaptersRead() {
    if (!(await confirm("Marcar todos os capítulos deste mangá como lidos?"))) {
      return;
    }

    setActionError(null);
    setAllChaptersActionPending(true);
    try {
      await apiClient.put(`/api/manga/${mangadexId}/read-all`);
      setData((current) =>
        current
          ? {
              volumes: current.volumes.map((volume) => ({
                ...volume,
                chapters: volume.chapters.map((chapter) => ({ ...chapter, read: true })),
              })),
            }
          : current,
      );
    } catch {
      setActionError("Falha ao salvar. Tente novamente.");
    } finally {
      setAllChaptersActionPending(false);
    }
  }

  if (loadError) {
    return <p role="alert">Falha ao carregar os capítulos.</p>;
  }
  if (!data) {
    return <p className={styles.hint}>Carregando capítulos...</p>;
  }
  if (data.volumes.length === 0) {
    return null;
  }

  const selected = data.volumes.find((volume) => volume.volumeNumber === selectedVolume) ?? null;
  const allRead =
    selected !== null && selected.chapters.length > 0 && selected.chapters.every((c) => c.read);

  return (
    <section className={styles.section}>
      <h2>Capítulos</h2>
      {actionError && <p role="alert">{actionError}</p>}

      <button
        type="button"
        className={styles.volumeToggle}
        disabled={allChaptersActionPending}
        onClick={markAllChaptersRead}
      >
        Marcar mangá inteiro como lido
      </button>

      <div className={styles.volumeTabs} role="tablist">
        {data.volumes.map((volume) => (
          <button
            key={volume.volumeNumber}
            type="button"
            role="tab"
            aria-selected={volume.volumeNumber === selectedVolume}
            className={styles.volumeTab}
            onClick={() => setSelectedVolume(volume.volumeNumber)}
          >
            {volumeLabel(volume.volumeNumber)}
          </button>
        ))}
      </div>

      {selected && (
        <>
          <button
            type="button"
            className={styles.volumeToggle}
            disabled={volumeActionPending}
            onClick={toggleVolume}
          >
            {allRead ? "Desmarcar volume inteiro" : "Marcar volume inteiro"}
          </button>

          <ul className={styles.chapterList}>
            {selected.chapters.map((chapter) => (
              <li key={chapter.chapterNumber} className={styles.chapter}>
                <span className={styles.chapterNumber}>{chapterLabel(chapter.chapterNumber)}</span>
                <label className={styles.readToggle}>
                  <input
                    type="checkbox"
                    checked={chapter.read}
                    onChange={(event) =>
                      toggleChapter(
                        selected.volumeNumber,
                        chapter.chapterNumber,
                        event.target.checked,
                      )
                    }
                  />
                  <span>Lido</span>
                </label>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

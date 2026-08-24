import type { MangaVolumesResponse } from "@cqntrack/shared";
import { and, eq } from "drizzle-orm";
import type { createDb } from "../db/client";
import { activity, mangaChapterRead } from "../db/schema";
import { getMangaAggregate } from "../integrations/mangadex/manga";
import { ensureMangaEntry } from "./entries.service";
import { toActivitySnapshot } from "./manga.service";

type Db = ReturnType<typeof createDb>;

function chapterKey(volumeNumber: number, chapterNumber: number): string {
  return `${volumeNumber}-${chapterNumber}`;
}

// "none" (capítulo sem volume atribuído) vira o sentinela 0 — ver
// db/schema/manga.schema.ts pro racional completo.
function toVolumeNumber(rawVolume: string): number {
  return rawVolume === "none" ? 0 : Number(rawVolume);
}

// A MangaDex também usa "none" pro CAPÍTULO em si (não só pro volume) —
// confirmado na prática: oneshot/doujinshi sem numeração de capítulo
// nenhuma (ex. "JoJo x Death Note (Doujinshi)", aggregate devolve
// `chapter: "none"`). Sentinela `-1` (não `0`, que já é um número de
// capítulo legítimo — muita obra numera o prólogo como "Capítulo 0") —
// sem esse tratamento, `Number("none")` vira `NaN` e quebra a validação
// Zod de `chapterNumber` (bug real encontrado testando esta função contra
// a API de verdade).
function toChapterNumber(rawChapter: string): number {
  return rawChapter === "none" ? -1 : Number(rawChapter);
}

// Busca a estrutura de volume/capítulo ao vivo na MangaDex (sem cache
// local, ver db/schema/manga.schema.ts) e marca `read` a partir de
// manga_chapter_read.
export async function getMangaVolumes(
  db: Db,
  userId: string,
  mangadexId: string,
): Promise<MangaVolumesResponse> {
  const raw = await getMangaAggregate(mangadexId);

  const readRows = await db
    .select({
      volumeNumber: mangaChapterRead.volumeNumber,
      chapterNumber: mangaChapterRead.chapterNumber,
    })
    .from(mangaChapterRead)
    .where(and(eq(mangaChapterRead.userId, userId), eq(mangaChapterRead.mangaId, mangadexId)));
  const readKeys = new Set(readRows.map((row) => chapterKey(row.volumeNumber, row.chapterNumber)));

  const volumes = Object.values(raw.volumes)
    .map((volume) => {
      const volumeNumber = toVolumeNumber(volume.volume);
      const chapters = Object.values(volume.chapters)
        .map((chapter) => {
          const chapterNumber = toChapterNumber(chapter.chapter);
          return {
            chapterNumber,
            mangadexChapterId: chapter.id,
            read: readKeys.has(chapterKey(volumeNumber, chapterNumber)),
          };
        })
        .sort((a, b) => a.chapterNumber - b.chapterNumber);
      return { volumeNumber, chapters };
    })
    .sort((a, b) => a.volumeNumber - b.volumeNumber);

  return { volumes };
}

// Marcar 1 capítulo é ruído demais pro feed de atividade — sem log aqui
// (diferente de setVolumeRead). Confia que a UI só deixa marcar depois que
// o volume já carregou da MangaDex (sem validação extra de que o capítulo
// existe de fato) — mesmo espírito de setEpisodeWatched (série).
export async function setChapterRead(
  db: Db,
  userId: string,
  mangadexId: string,
  volumeNumber: number,
  chapterNumber: number,
  read: boolean,
): Promise<void> {
  await ensureMangaEntry(db, userId, mangadexId);

  if (read) {
    await db
      .insert(mangaChapterRead)
      .values({ userId, mangaId: mangadexId, volumeNumber, chapterNumber })
      .onConflictDoNothing();
  } else {
    await db
      .delete(mangaChapterRead)
      .where(
        and(
          eq(mangaChapterRead.userId, userId),
          eq(mangaChapterRead.mangaId, mangadexId),
          eq(mangaChapterRead.volumeNumber, volumeNumber),
          eq(mangaChapterRead.chapterNumber, chapterNumber),
        ),
      );
  }
}

// Volume inteiro é um evento grosso o bastante pra valer aparecer no feed —
// só ao marcar (desmarcar não gera atividade, mesmo espírito de
// "desfavoritar não gera atividade"). Mesmo formato de setSeasonWatched
// (série): devolve `false` quando o volume pedido não existe na MangaDex
// (rota trata como 404).
export async function setVolumeRead(
  db: Db,
  userId: string,
  mangadexId: string,
  volumeNumber: number,
  read: boolean,
): Promise<boolean> {
  const { cachedManga } = await ensureMangaEntry(db, userId, mangadexId);

  if (!read) {
    await db
      .delete(mangaChapterRead)
      .where(
        and(
          eq(mangaChapterRead.userId, userId),
          eq(mangaChapterRead.mangaId, mangadexId),
          eq(mangaChapterRead.volumeNumber, volumeNumber),
        ),
      );
    return true;
  }

  const raw = await getMangaAggregate(mangadexId);
  const volumeKey = volumeNumber === 0 ? "none" : String(volumeNumber);
  const volume = raw.volumes[volumeKey];
  if (!volume) {
    return false;
  }

  const chapterNumbers = Object.values(volume.chapters).map((chapter) =>
    toChapterNumber(chapter.chapter),
  );
  if (chapterNumbers.length > 0) {
    await db
      .insert(mangaChapterRead)
      .values(
        chapterNumbers.map((chapterNumber) => ({
          userId,
          mangaId: mangadexId,
          volumeNumber,
          chapterNumber,
        })),
      )
      .onConflictDoNothing();
  }

  await db.insert(activity).values({
    userId,
    ...toActivitySnapshot(cachedManga),
    type: "volume_read",
    metadata: { volume: volumeNumber, chapterCount: chapterNumbers.length },
  });

  return true;
}

// Mangá inteiro de uma vez (item 5 do pedido do usuário) — diferente da
// versão de série (setAllSeasonsWatched), a MangaDex já devolve a estrutura
// completa de volumes/capítulos numa única chamada (getMangaAggregate), sem
// precisar de N requests. Uma atividade agregada em vez de uma por volume.
// Só marca — sem versão "desmarcar tudo", não pedida.
export async function setAllChaptersRead(
  db: Db,
  userId: string,
  mangadexId: string,
): Promise<void> {
  const { cachedManga } = await ensureMangaEntry(db, userId, mangadexId);

  const raw = await getMangaAggregate(mangadexId);
  const rows = Object.values(raw.volumes).flatMap((volume) => {
    const volumeNumber = toVolumeNumber(volume.volume);
    return Object.values(volume.chapters).map((chapter) => ({
      userId,
      mangaId: mangadexId,
      volumeNumber,
      chapterNumber: toChapterNumber(chapter.chapter),
    }));
  });

  if (rows.length > 0) {
    await db.insert(mangaChapterRead).values(rows).onConflictDoNothing();
  }

  await db.insert(activity).values({
    userId,
    ...toActivitySnapshot(cachedManga),
    type: "manga_completed",
    metadata: { chapterCount: rows.length },
  });
}

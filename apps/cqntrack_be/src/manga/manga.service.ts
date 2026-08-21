import { MANGA_PUBLICATION_STATUSES, type MangaSummary } from "@cqntrack/shared";
import { eq } from "drizzle-orm";
import type { createDb } from "../db/client";
import { manga } from "../db/schema";
import {
  discoverManga as mangadexDiscover,
  getMangaById as mangadexGetById,
  searchManga as mangadexSearch,
} from "../integrations/mangadex/manga";
import type { MangaDexLocalizedString, MangaDexManga } from "../integrations/mangadex/types";

type Db = ReturnType<typeof createDb>;
export type CachedManga = typeof manga.$inferSelect;

export class MangaNotFoundError extends Error {
  constructor(public readonly mangadexId: string) {
    super(`Mangá ${mangadexId} não encontrado na MangaDex`);
    this.name = "MangaNotFoundError";
  }
}

// Campos de snapshot pra gravar na tabela genérica `activity` — mesmo
// formato de toActivitySnapshot em books.service.ts, só trocando o domínio.
export function toActivitySnapshot(cachedManga: CachedManga) {
  return {
    mediaType: "manga" as const,
    itemId: cachedManga.mangadexId,
    itemTitle: cachedManga.title,
    itemHref: `/mangas/${cachedManga.mangadexId}`,
    itemCoverUrl: cachedManga.coverUrl,
  };
}

// "en" primeiro (idioma padrão do app), senão o primeiro valor disponível —
// título/descrição de mangá japonês raramente tem "en" preenchido, mas quase
// sempre tem PELO MENOS um idioma (romaji, ja, etc.).
function pickLocalized(value: MangaDexLocalizedString | undefined): string | null {
  if (!value) return null;
  return value.en ?? Object.values(value)[0] ?? null;
}

function pickTitle(raw: MangaDexManga): string {
  const fromTitle = pickLocalized(raw.attributes.title);
  if (fromTitle) return fromTitle;
  for (const alt of raw.attributes.altTitles) {
    const value = pickLocalized(alt);
    if (value) return value;
  }
  return raw.id;
}

function isPublicationStatus(value: string): value is (typeof MANGA_PUBLICATION_STATUSES)[number] {
  return (MANGA_PUBLICATION_STATUSES as readonly string[]).includes(value);
}

const COVER_BASE_URL = "https://uploads.mangadex.org/covers";

function coverUrlFromManga(raw: MangaDexManga): string | null {
  const coverArt = raw.relationships.find((r) => r.type === "cover_art");
  return coverArt?.attributes?.fileName
    ? `${COVER_BASE_URL}/${raw.id}/${coverArt.attributes.fileName}.512.jpg`
    : null;
}

// author + artist deduplicados por id — muitos oneshots/doujinshi creditam a
// mesma pessoa nos dois papéis (mesmo id de relationship duas vezes).
function authorsFromManga(raw: MangaDexManga): { id: string; name: string }[] {
  const byId = new Map<string, string>();
  for (const r of raw.relationships) {
    if ((r.type === "author" || r.type === "artist") && r.attributes?.name) {
      byId.set(r.id, r.attributes.name);
    }
  }
  return [...byId.entries()].map(([id, name]) => ({ id, name }));
}

function tagsFromManga(raw: MangaDexManga): string[] {
  return raw.attributes.tags
    .filter((tag) => tag.attributes.group === "genre" || tag.attributes.group === "theme")
    .map((tag) => pickLocalized(tag.attributes.name))
    .filter((name): name is string => Boolean(name));
}

// Mapeia um mangá cru da MangaDex pro DTO exposto — busca, descobrir e
// detalhe usam a mesma forma de objeto (diferente da TMDB, que separa
// "resultado de busca" de "detalhe"), então um único mapeador de resumo
// serve pros três casos.
export function mapMangaToSummary(raw: MangaDexManga): MangaSummary {
  return {
    mangadexId: raw.id,
    title: pickTitle(raw),
    coverUrl: coverUrlFromManga(raw),
    authors: authorsFromManga(raw),
    tags: tagsFromManga(raw),
    publicationStatus: isPublicationStatus(raw.attributes.status) ? raw.attributes.status : null,
    year: raw.attributes.year,
  };
}

// Mesma forma de mapMangaToSummary, mas a partir de uma linha já cacheada no
// D1 (manga), usada por qualquer rota que leia mangás do próprio banco em
// vez de consultar a MangaDex de novo (entries, favoritos, listas etc.).
export function mapCachedMangaToSummary(row: CachedManga): MangaSummary {
  return {
    mangadexId: row.mangadexId,
    title: row.title,
    coverUrl: row.coverUrl,
    authors: row.authors ?? [],
    tags: row.tags ?? [],
    publicationStatus: row.publicationStatus,
    year: row.year,
  };
}

export async function searchMangaForUser(query: string, limit: number): Promise<MangaSummary[]> {
  const results = await mangadexSearch(query, limit);
  return results.map(mapMangaToSummary);
}

const DISCOVER_PAGE_SIZE = 20;

export async function discoverMangaForUser(
  page: number,
): Promise<{ results: MangaSummary[]; hasMore: boolean }> {
  const { results, total } = await mangadexDiscover(page, DISCOVER_PAGE_SIZE);
  return {
    results: results.map(mapMangaToSummary),
    hasMore: page * DISCOVER_PAGE_SIZE < total,
  };
}

// Mesmo TTL/motivo de getOrCacheBook: dados de mangá também mudam com o
// tempo (status de publicação muda, sinopse é corrigida). Diferente de
// filme/série, `isStale` aqui é SÓ por tempo — não fazemos uma 2ª chamada de
// "créditos" separada pra esse cache, então não existe coluna que fique
// null pra sempre e force revalidação eterna.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function isStale(row: CachedManga): boolean {
  return Date.now() - row.updatedAt.getTime() > CACHE_TTL_MS;
}

function mapMangaToRow(raw: MangaDexManga) {
  return {
    title: pickTitle(raw),
    coverUrl: coverUrlFromManga(raw),
    description: pickLocalized(raw.attributes.description),
    authors: authorsFromManga(raw),
    tags: tagsFromManga(raw),
    publicationStatus: isPublicationStatus(raw.attributes.status) ? raw.attributes.status : null,
    contentRating: raw.attributes.contentRating,
    year: raw.attributes.year,
  };
}

// Busca o mangá no cache local (manga); se não existir OU se o cache
// estiver velho, consulta a MangaDex e grava (insert ou update) antes de
// devolver. `onConflictDoNothing` torna o insert seguro sob requests
// concorrentes cacheando o mesmo mangá pela primeira vez. Sem `env: Env`
// (diferente de getOrCacheBook/getOrCacheMovie): a MangaDex é 100% pública,
// não precisa de key.
export async function getOrCacheManga(db: Db, mangadexId: string): Promise<CachedManga> {
  const [cached] = await db.select().from(manga).where(eq(manga.mangadexId, mangadexId));
  if (cached && !isStale(cached)) {
    return cached;
  }

  const raw = await mangadexGetById(mangadexId);
  if (!raw) {
    // MangaDex indisponível ou mangá removido de lá — melhor devolver o
    // cache velho (se existir) do que quebrar a tela por causa da
    // revalidação.
    if (cached) {
      return cached;
    }
    throw new MangaNotFoundError(mangadexId);
  }

  const values = mapMangaToRow(raw);

  if (cached) {
    await db.update(manga).set(values).where(eq(manga.mangadexId, mangadexId));
  } else {
    await db
      .insert(manga)
      .values({ mangadexId: raw.id, ...values })
      .onConflictDoNothing();
  }

  const [row] = await db.select().from(manga).where(eq(manga.mangadexId, mangadexId));
  if (!row) {
    // Não deveria acontecer (acabamos de inserir, ou outra request
    // concorrente já tinha inserido) — só pra manter o tipo de retorno
    // não-nulo com segurança.
    throw new MangaNotFoundError(mangadexId);
  }
  return row;
}

import type { BookSummary } from "@cqntrack/shared";
import { eq } from "drizzle-orm";
import type { createDb } from "../db/client";
import { book } from "../db/schema";
import { getBookById, searchBooks as googleBooksSearch } from "../integrations/googlebooks/books";
import { stripHtml, toSecureImageUrl, type GoogleBooksVolume } from "../integrations/googlebooks/types";

type Db = ReturnType<typeof createDb>;
export type CachedBook = typeof book.$inferSelect;

export class BookNotFoundError extends Error {
  constructor(public readonly googleBooksId: string) {
    super(`Livro ${googleBooksId} não encontrado na Google Books`);
    this.name = "BookNotFoundError";
  }
}

// Campos de snapshot pra gravar na tabela genérica `activity` — mesmo
// formato de toActivitySnapshot em movies.service.ts, só trocando o domínio.
export function toActivitySnapshot(cachedBook: CachedBook) {
  return {
    mediaType: "books" as const,
    itemId: cachedBook.googleBooksId,
    itemTitle: cachedBook.title,
    itemHref: `/livros/${cachedBook.googleBooksId}`,
    itemCoverUrl: cachedBook.coverUrl,
  };
}

function coverUrlFromVolume(volumeInfo: GoogleBooksVolume["volumeInfo"]): string | null {
  const raw = volumeInfo.imageLinks?.thumbnail ?? volumeInfo.imageLinks?.smallThumbnail;
  return raw ? toSecureImageUrl(raw) : null;
}

// Mapeia um volume da Google Books pro DTO exposto — busca e detalhe usam a
// mesma forma de objeto (diferente da TMDB, que separa "resultado de busca"
// de "detalhe"), então um único mapeador serve pros dois casos.
export function mapVolumeToSummary(volume: GoogleBooksVolume): BookSummary {
  return {
    googleBooksId: volume.id,
    title: volume.volumeInfo.title,
    authors: volume.volumeInfo.authors ?? [],
    coverUrl: coverUrlFromVolume(volume.volumeInfo),
    publishedDate: volume.volumeInfo.publishedDate ?? null,
    categories: volume.volumeInfo.categories ?? [],
    pageCount: volume.volumeInfo.pageCount ?? null,
    rating: volume.volumeInfo.averageRating ?? null,
  };
}

// Mesma forma de mapVolumeToSummary, mas a partir de uma linha já cacheada
// no D1 (book), usada por qualquer rota que leia livros do próprio banco em
// vez de consultar a Google Books de novo (detalhe, "meus livros", listas etc.).
export function mapCachedBookToSummary(row: CachedBook): BookSummary {
  return {
    googleBooksId: row.googleBooksId,
    title: row.title,
    authors: row.authors ?? [],
    coverUrl: row.coverUrl,
    publishedDate: row.publishedDate,
    categories: row.categories ?? [],
    pageCount: row.pageCount,
    rating: row.rating,
  };
}

export async function searchBooksForUser(env: Env, query: string, limit: number): Promise<BookSummary[]> {
  const results = await googleBooksSearch(env, query, limit);
  return results.map(mapVolumeToSummary);
}

// Mesmo TTL/motivo de getOrCacheMovie: dados de livro também mudam com o
// tempo (nota agregada sobe, sinopse é corrigida) — evita o bug de cache
// "eterno" já corrigido em produção pra série.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function isStale(row: CachedBook): boolean {
  return Date.now() - row.updatedAt.getTime() > CACHE_TTL_MS;
}

function mapVolumeToRow(volume: GoogleBooksVolume) {
  return {
    title: volume.volumeInfo.title,
    authors: volume.volumeInfo.authors ?? [],
    coverUrl: coverUrlFromVolume(volume.volumeInfo),
    publishedDate: volume.volumeInfo.publishedDate ?? null,
    description: volume.volumeInfo.description ? stripHtml(volume.volumeInfo.description) : null,
    categories: volume.volumeInfo.categories ?? [],
    pageCount: volume.volumeInfo.pageCount ?? null,
    rating: volume.volumeInfo.averageRating ?? null,
  };
}

// Busca o livro no cache local (book); se não existir OU se o cache estiver
// velho, consulta a Google Books e grava (insert ou update) antes de
// devolver. `onConflictDoNothing` torna o insert seguro sob requests
// concorrentes cacheando o mesmo livro pela primeira vez.
export async function getOrCacheBook(env: Env, db: Db, googleBooksId: string): Promise<CachedBook> {
  const [cached] = await db.select().from(book).where(eq(book.googleBooksId, googleBooksId));
  if (cached && !isStale(cached)) {
    return cached;
  }

  const volume = await getBookById(env, googleBooksId);
  if (!volume) {
    // Google Books indisponível ou livro removido de lá — melhor devolver o
    // cache velho (se existir) do que quebrar a tela por causa da revalidação.
    if (cached) {
      return cached;
    }
    throw new BookNotFoundError(googleBooksId);
  }

  const values = mapVolumeToRow(volume);

  if (cached) {
    await db.update(book).set(values).where(eq(book.googleBooksId, googleBooksId));
  } else {
    await db
      .insert(book)
      .values({ googleBooksId: volume.id, ...values })
      .onConflictDoNothing();
  }

  const [row] = await db.select().from(book).where(eq(book.googleBooksId, googleBooksId));
  if (!row) {
    // Não deveria acontecer (acabamos de inserir, ou outra request concorrente
    // já tinha inserido) — só pra manter o tipo de retorno não-nulo com segurança.
    throw new BookNotFoundError(googleBooksId);
  }
  return row;
}

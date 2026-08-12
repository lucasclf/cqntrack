import type { AuthorBooksResponse } from "@cqntrack/shared";
import { searchBooks as googleBooksSearch } from "../integrations/googlebooks/books";
import { mapVolumeToSummary } from "./books.service";

// A Google Books não tem endpoint de "autor" — simula com busca textual
// (inauthor:"nome"), reaproveitando searchBooks já existente (mesmo
// client, mesmo limite de 40 resultados). Sem "não encontrado": diferente
// de pessoa (TMDB tem um ID que existe ou não), aqui não há uma entidade
// pra não achar — nome sem nenhum livro correspondente só devolve
// books: [].
export async function getAuthorBooks(env: Env, rawName: string): Promise<AuthorBooksResponse> {
  const name = rawName.trim();
  const results = await googleBooksSearch(env, `inauthor:"${name}"`, 40);

  // inauthor: é busca textual, não garante identidade — filtra pra manter
  // só volumes que realmente creditam esse nome exato (case-insensitive,
  // já aparado por mapVolumeToSummary), descartando ruído da busca.
  const books = results
    .map(mapVolumeToSummary)
    .filter((book) => book.authors.some((author) => author.toLowerCase() === name.toLowerCase()));

  books.sort((a, b) => (b.publishedDate ?? "").localeCompare(a.publishedDate ?? ""));

  return { name, books };
}

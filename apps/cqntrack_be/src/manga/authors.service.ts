import type { AuthorMangaResponse } from "@cqntrack/shared";
import { getAuthorById, getMangaByAuthor } from "../integrations/mangadex/author";
import { mapMangaToSummary } from "./manga.service";

// Diferente de getAuthorBooks (livro, busca textual sem ID de verdade): a
// MangaDex tem um recurso de autor de verdade — resolve pelo ID e devolve o
// nome já vindo da própria API, não ecoando o parâmetro da rota.
export async function getAuthorManga(authorId: string): Promise<AuthorMangaResponse | null> {
  const author = await getAuthorById(authorId);
  if (!author) {
    return null;
  }

  const results = await getMangaByAuthor(authorId);
  return {
    id: author.id,
    name: author.attributes.name,
    manga: results.map(mapMangaToSummary),
  };
}

import { MangaDexRequestError, mangadexFetch } from "./client";
import { DEFAULT_CONTENT_RATING, DEFAULT_INCLUDES } from "./manga";
import type {
  MangaDexAuthor,
  MangaDexAuthorResponse,
  MangaDexManga,
  MangaDexSearchResponse,
} from "./types";

// Diferente de livro (Google Books não tem endpoint de autor — a página é
// simulada com busca textual, ver books/authors.service.ts): a MangaDex tem
// um recurso de autor de verdade, com ID próprio.
export async function getAuthorById(id: string): Promise<MangaDexAuthor | null> {
  try {
    const response = await mangadexFetch<MangaDexAuthorResponse>(
      `/author/${encodeURIComponent(id)}`,
    );
    return response.data;
  } catch (error) {
    if (error instanceof MangaDexRequestError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

// Filtra só por `authors[]` (não `artists[]`) — confirmado funcionando na
// API real. A MangaDex não expõe um filtro combinado "autor OU artista", e
// fazer 2 requests + merge/dedupe por causa disso não vale o custo pra um
// projeto pessoal — mangá onde essa pessoa é creditada só como artista (não
// como autor) não aparece aqui. Mesmo nível de "sem heurística extra" que
// authors.service.ts (livro) já assume pra busca textual.
export async function getMangaByAuthor(authorId: string, limit = 100): Promise<MangaDexManga[]> {
  const response = await mangadexFetch<MangaDexSearchResponse>(
    `/manga?authors[]=${encodeURIComponent(authorId)}&limit=${limit}&${DEFAULT_INCLUDES}&${DEFAULT_CONTENT_RATING}`,
  );
  return response.data;
}

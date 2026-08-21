import { MangaDexRequestError, mangadexFetch } from "./client";
import type {
  MangaDexAggregateResponse,
  MangaDexManga,
  MangaDexMangaResponse,
  MangaDexSearchResponse,
} from "./types";

// Filtro de conteúdo padrão pra busca/descobrir/autor — exclui erotica/
// pornographic (a MangaDex hospeda bastante conteúdo adulto). Decisão
// tomada no plano, fácil de tornar configurável depois se necessário.
export const DEFAULT_CONTENT_RATING = "contentRating[]=safe&contentRating[]=suggestive";
export const DEFAULT_INCLUDES = "includes[]=cover_art&includes[]=author&includes[]=artist";

export async function searchManga(query: string, limit = 20): Promise<MangaDexManga[]> {
  const safeQuery = encodeURIComponent(query.slice(0, 100));
  const safeLimit = Math.min(Math.max(limit, 1), 40);
  const response = await mangadexFetch<MangaDexSearchResponse>(
    `/manga?title=${safeQuery}&limit=${safeLimit}&${DEFAULT_INCLUDES}&${DEFAULT_CONTENT_RATING}`,
  );
  return response.data;
}

export async function getMangaById(id: string): Promise<MangaDexManga | null> {
  try {
    const response = await mangadexFetch<MangaDexMangaResponse>(
      `/manga/${encodeURIComponent(id)}?${DEFAULT_INCLUDES}`,
    );
    return response.data;
  } catch (error) {
    if (error instanceof MangaDexRequestError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

// Populares de verdade via order[followedCount] — confirmado na API real
// (Solo Leveling, Chainsaw Man etc. aparecem no topo). Diferente de livro,
// que não tem Discover (Google Books não suporta popularidade).
export async function discoverManga(
  page: number,
  pageSize = 20,
): Promise<{ results: MangaDexManga[]; total: number }> {
  const offset = (page - 1) * pageSize;
  const response = await mangadexFetch<MangaDexSearchResponse>(
    `/manga?limit=${pageSize}&offset=${offset}&order[followedCount]=desc&${DEFAULT_INCLUDES}&${DEFAULT_CONTENT_RATING}`,
  );
  return { results: response.data, total: response.total };
}

// Buscado AO VIVO, sem cache (mesmo padrão da lista de episódios de série,
// ver series.schema.ts) — mangá em lançamento ganha capítulo novo toda
// semana, e cachear isso custaria uma chamada extra a /aggregate por item só
// pra manter atualizado. Sem filtro de idioma de propósito: pega a numeração
// canônica completa (não só o que tem tradução em inglês). O parse do shape
// bruto (chapter/volume como string, "none" etc.) fica em chapters.service.ts,
// não aqui — esta função só busca e devolve o shape cru da MangaDex.
export async function getMangaAggregate(id: string): Promise<MangaDexAggregateResponse> {
  return mangadexFetch<MangaDexAggregateResponse>(`/manga/${encodeURIComponent(id)}/aggregate`);
}

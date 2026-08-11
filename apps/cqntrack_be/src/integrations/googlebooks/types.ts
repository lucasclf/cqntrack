// Formato bruto retornado pela Google Books API — nunca exposto ao
// frontend diretamente; sempre mapeado para os DTOs de @cqntrack/shared
// antes de sair de src/books/. Diferente da TMDB/IGDB, busca e detalhe
// devolvem a mesma forma de objeto (volumeInfo completo nos dois) — sem
// dois tipos separados de subconjunto de campos.
export interface GoogleBooksVolume {
  id: string;
  volumeInfo: {
    title: string;
    authors?: string[];
    publishedDate?: string; // "YYYY", "YYYY-MM" ou "YYYY-MM-DD" — precisão variável
    description?: string;
    pageCount?: number;
    categories?: string[];
    imageLinks?: {
      smallThumbnail?: string;
      thumbnail?: string;
    };
    averageRating?: number; // 0-5, só presente quando há avaliações suficientes
  };
}

export interface GoogleBooksSearchResponse {
  items?: GoogleBooksVolume[]; // ausente (não vazio) quando a busca não encontra nada
  totalItems: number;
}

// A Google Books às vezes devolve thumbnail como http:// — troca pra
// https:// pra não ser bloqueado como mixed content numa página HTTPS.
export function toSecureImageUrl(url: string): string {
  return url.replace(/^http:\/\//, "https://");
}

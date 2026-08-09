// Formato bruto retornado pela IGDB (Apicalypse) — nunca exposto ao frontend
// diretamente; sempre mapeado para os DTOs de @cqntrack/shared antes de sair
// de src/games/.
export interface IgdbGame {
  id: number;
  name: string;
  slug: string;
  summary?: string;
  first_release_date?: number; // unix seconds
  total_rating?: number; // 0-100, nota agregada da própria IGDB
  cover?: { image_id: string };
  genres?: { name: string }[];
  platforms?: { name: string }[];
}

export type IgdbImageSize =
  | "thumb"
  | "cover_small"
  | "cover_big"
  | "screenshot_med"
  | "screenshot_big"
  | "720p"
  | "1080p";

export function buildCoverUrl(imageId: string, size: IgdbImageSize = "cover_big"): string {
  return `https://images.igdb.com/igdb/image/upload/t_${size}/${imageId}.jpg`;
}

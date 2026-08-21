// Formato bruto retornado pela API do MangaDex — nunca exposto ao frontend
// diretamente; sempre mapeado para os DTOs de @cqntrack/shared antes de sair
// de src/manga/. Campos multi-idioma (title/description/tag name) vêm como
// objeto `{ [código do idioma]: string }` — nem sempre tem "en" (título só
// em japonês/romaji é comum), ver pickLocalized em manga.ts.
export type MangaDexLocalizedString = Record<string, string>;

export interface MangaDexTag {
  attributes: {
    name: MangaDexLocalizedString;
    group: string; // "genre" | "theme" | "format" | "content"
  };
}

// `attributes` só vem preenchido pros tipos que a query pediu via
// `includes[]` (author/artist/cover_art) — os demais tipos de relationship
// (ex. "creator", "manga" de obra relacionada) aparecem só com `id`/`type`.
export interface MangaDexRelationship {
  id: string;
  type: string;
  attributes?: {
    name?: string; // author | artist
    fileName?: string; // cover_art
  };
}

export interface MangaDexMangaAttributes {
  title: MangaDexLocalizedString;
  altTitles: MangaDexLocalizedString[];
  description: MangaDexLocalizedString;
  status: string; // ongoing | completed | hiatus | cancelled
  contentRating: string; // safe | suggestive | erotica | pornographic
  year: number | null;
  tags: MangaDexTag[];
}

export interface MangaDexManga {
  id: string;
  attributes: MangaDexMangaAttributes;
  relationships: MangaDexRelationship[];
}

export interface MangaDexMangaResponse {
  data: MangaDexManga;
}

export interface MangaDexSearchResponse {
  data: MangaDexManga[];
  total: number;
}

// `chapter`/`volume` vêm como STRING de propósito na API — capítulo pode
// ser decimal ("10.5", extra/bônus) e volume pode ser "none" (capítulo
// avulso, sem volume atribuído).
export interface MangaDexAggregateChapter {
  chapter: string;
  id: string;
}

export interface MangaDexAggregateVolume {
  volume: string;
  chapters: Record<string, MangaDexAggregateChapter>;
}

export interface MangaDexAggregateResponse {
  volumes: Record<string, MangaDexAggregateVolume>;
}

export interface MangaDexAuthor {
  id: string;
  attributes: { name: string };
}

export interface MangaDexAuthorResponse {
  data: MangaDexAuthor;
}

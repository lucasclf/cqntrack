import { z } from "zod";

// DTO enxuto de uma série — nunca a entity Drizzle crua. `rating` aqui é a
// nota agregada da própria TMDB (0-10) — não confundir com a nota pessoal do
// usuário (0-5), que vive em SeriesEntrySchema (adicionado numa etapa
// futura). numberOfSeasons/numberOfEpisodes só vêm preenchidos quando a
// série já foi cacheada via detalhe — a busca da TMDB não traz esse dado.
export const SeriesSummarySchema = z.object({
  tmdbId: z.number().int(),
  name: z.string(),
  posterUrl: z.url().nullable(),
  firstAirDate: z.iso.date().nullable(),
  genres: z.array(z.string()),
  numberOfSeasons: z.number().int().nullable(),
  numberOfEpisodes: z.number().int().nullable(),
  rating: z.number().nullable(),
});

export type SeriesSummary = z.infer<typeof SeriesSummarySchema>;

export const SearchSeriesQuerySchema = z.object({
  q: z.string().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type SearchSeriesQuery = z.infer<typeof SearchSeriesQuerySchema>;

export const SearchSeriesResponseSchema = z.object({
  results: z.array(SeriesSummarySchema),
});

export type SearchSeriesResponse = z.infer<typeof SearchSeriesResponseSchema>;

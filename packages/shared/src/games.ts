import { z } from "zod";

// DTO enxuto de um jogo — nunca a entity Drizzle crua. `rating` aqui é a nota
// agregada da própria IGDB (0-100); não confundir com a nota pessoal do
// usuário (0-5), que vive em GameEntrySchema (adicionado numa etapa futura).
export const GameSummarySchema = z.object({
  igdbId: z.number().int(),
  name: z.string(),
  coverUrl: z.url().nullable(),
  firstReleaseDate: z.iso.date().nullable(),
  platforms: z.array(z.string()),
  genres: z.array(z.string()),
  rating: z.number().nullable(),
});

export type GameSummary = z.infer<typeof GameSummarySchema>;

export const SearchGamesQuerySchema = z.object({
  q: z.string().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type SearchGamesQuery = z.infer<typeof SearchGamesQuerySchema>;

export const SearchGamesResponseSchema = z.object({
  results: z.array(GameSummarySchema),
});

export type SearchGamesResponse = z.infer<typeof SearchGamesResponseSchema>;

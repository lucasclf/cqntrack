import { z } from "zod";

// Fonte única de verdade dos 5 status — importado tanto pelo schema Drizzle
// (enum da coluna) quanto pelo z.enum abaixo.
export const GAME_STATUSES = ["not_started", "playing", "dropped", "completed", "platinum"] as const;

export const GameStatusSchema = z.enum(GAME_STATUSES);

export type GameStatus = z.infer<typeof GameStatusSchema>;

export const GAME_STATUS_LABELS: Record<GameStatus, string> = {
  not_started: "Não Iniciado",
  playing: "Jogando",
  dropped: "Abandonado",
  completed: "Finalizado",
  platinum: "Platinado",
};

export const GAME_ACTIVITY_TYPES = [
  "status_changed",
  "favorited",
  "rated",
  "reviewed",
  "added_to_list",
] as const;

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

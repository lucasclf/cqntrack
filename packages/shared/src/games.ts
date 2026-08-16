import { z } from "zod";

// Fonte única de verdade dos 5 status — importado tanto pelo schema Drizzle
// (enum da coluna) quanto pelo z.enum abaixo.
export const GAME_STATUSES = [
  "not_started",
  "playing",
  "dropped",
  "completed",
  "platinum",
] as const;

export const GameStatusSchema = z.enum(GAME_STATUSES);

export type GameStatus = z.infer<typeof GameStatusSchema>;

export const GAME_STATUS_LABELS: Record<GameStatus, string> = {
  not_started: "Quero jogar",
  playing: "Jogando",
  dropped: "Abandonado",
  completed: "Finalizado",
  platinum: "Platinado",
};

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

// Tela "Descobrir" (aclamados da própria IGDB, ordenado por total_rating com
// um piso de avaliações pra evitar jogo obscuro com 1 nota 100) — vira o
// índice da seção de jogos no menu superior. Mesmo espírito de
// DiscoverMoviesResponseSchema/DiscoverSeriesResponseSchema.
export const DiscoverGamesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(500).default(1),
});

export type DiscoverGamesQuery = z.infer<typeof DiscoverGamesQuerySchema>;

export const DiscoverGamesResponseSchema = z.object({
  results: z.array(GameSummarySchema),
  page: z.number().int(),
  hasMore: z.boolean(),
});

export type DiscoverGamesResponse = z.infer<typeof DiscoverGamesResponseSchema>;

export const GameDetailSchema = GameSummarySchema.extend({
  summary: z.string().nullable(),
});

export type GameDetail = z.infer<typeof GameDetailSchema>;

// Marcação do usuário para um jogo específico — sem o `game` embutido (quem
// consome isso normalmente já sabe de qual jogo se trata pelo contexto da
// chamada). Ver GameEntryWithGameSchema para o caso de listas/feeds.
export const GameEntrySchema = z.object({
  id: z.string(),
  status: GameStatusSchema.nullable(),
  rating: z.number().nullable(),
  // Favoritar não tem mais limite de quantidade (ver FavoritesResponseSchema)
  // — null = esse jogo não está favoritado.
  favoritedAt: z.iso.datetime().nullable(),
  // Um jogo pode ter sido jogado em mais de uma plataforma — lista, não texto
  // único. null = nenhuma selecionada.
  platforms: z.array(z.string()).nullable(),
  review: z.string().nullable(),
  updatedAt: z.iso.datetime(),
});

export type GameEntry = z.infer<typeof GameEntrySchema>;

export const GameEntryWithGameSchema = GameEntrySchema.extend({
  game: GameSummarySchema,
});

export type GameEntryWithGame = z.infer<typeof GameEntryWithGameSchema>;

export const GameDetailResponseSchema = z.object({
  game: GameDetailSchema,
  entry: GameEntrySchema.nullable(),
});

export type GameDetailResponse = z.infer<typeof GameDetailResponseSchema>;

export const UpsertGameEntryRequestSchema = z.object({
  status: GameStatusSchema.nullable().optional(),
  rating: z.number().min(0).max(5).multipleOf(0.5).nullable().optional(),
  review: z.string().max(2000).nullable().optional(),
  platforms: z.array(z.string().min(1).max(60)).max(10).nullable().optional(),
  favorited: z.boolean().optional(),
});

export type UpsertGameEntryRequest = z.infer<typeof UpsertGameEntryRequestSchema>;

// Sem limite de quantidade (não é mais um pool de 4 slots) — lista dos
// favoritos do usuário, já ordenada por favoritedAt decrescente (mais
// recente primeiro) pelo service, não pelo cliente.
export const FavoritesResponseSchema = z.object({
  items: z.array(GameEntryWithGameSchema),
});

export type FavoritesResponse = z.infer<typeof FavoritesResponseSchema>;

// "platform" (singular) continua sendo o nome do campo de ordenação/filtro —
// filtra/ordena por conter essa plataforma na lista `platforms` da entry.
// "favorite" ordena/filtra por favoritedAt (null = não favoritado).
export const GAME_ENTRY_SORT_FIELDS = [
  "status",
  "rating",
  "favorite",
  "platform",
  "updatedAt",
] as const;

export const ListGameEntriesQuerySchema = z.object({
  status: GameStatusSchema.optional(),
  favorite: z.coerce.boolean().optional(),
  platform: z.string().optional(),
  sortBy: z.enum(GAME_ENTRY_SORT_FIELDS).default("updatedAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(24),
});

export type ListGameEntriesQuery = z.infer<typeof ListGameEntriesQuerySchema>;

export const PaginatedGameEntriesResponseSchema = z.object({
  items: z.array(GameEntryWithGameSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});

export type PaginatedGameEntriesResponse = z.infer<typeof PaginatedGameEntriesResponseSchema>;

export const GameListSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  itemCount: z.number().int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type GameList = z.infer<typeof GameListSchema>;

export const GameListsResponseSchema = z.object({
  lists: z.array(GameListSchema),
});

export type GameListsResponse = z.infer<typeof GameListsResponseSchema>;

export const GameListDetailSchema = GameListSchema.extend({
  items: z.array(GameSummarySchema),
});

export type GameListDetail = z.infer<typeof GameListDetailSchema>;

export const CreateGameListRequestSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(300).nullable().optional(),
});

export type CreateGameListRequest = z.infer<typeof CreateGameListRequestSchema>;

export const UpdateGameListRequestSchema = CreateGameListRequestSchema.partial();

export type UpdateGameListRequest = z.infer<typeof UpdateGameListRequestSchema>;

// Perfil público (/@:username) — sem toggle de privacidade por item, tudo
// que existe aqui já é público por padrão (decisão de produto já fechada).
// Sem stats agregados (existia só pra jogos, tirado no redesign do perfil
// — a tela nova é toda baseada em grades de favoritos/recentes, não em
// contadores).
export const PublicProfileSchema = z.object({
  username: z.string(),
  displayUsername: z.string(),
  memberSince: z.iso.datetime(),
  image: z.url().nullable(),
});

export type PublicProfile = z.infer<typeof PublicProfileSchema>;

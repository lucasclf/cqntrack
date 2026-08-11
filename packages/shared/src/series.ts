import { z } from "zod";
import { FavoriteSlotNumberSchema } from "./favorites";

// Resumo de uma temporada — vem de graça no mesmo GET /tv/{id} que já
// cacheia a série, sem chamada extra à TMDB. A lista de episódios em si
// (nome/data/still de cada um) NÃO é cacheada — ver SeriesEpisodeSchema.
export const SeriesSeasonSummarySchema = z.object({
  seasonNumber: z.number().int(),
  name: z.string(),
  episodeCount: z.number().int(),
  airDate: z.iso.date().nullable(),
  posterUrl: z.url().nullable(),
});

export type SeriesSeasonSummary = z.infer<typeof SeriesSeasonSummarySchema>;

// DTO enxuto de uma série — nunca a entity Drizzle crua. `rating` aqui é a
// nota agregada da própria TMDB (0-10) — não confundir com a nota pessoal do
// usuário (0-5), que vive em SeriesEntrySchema (adicionado numa etapa
// futura). numberOfSeasons/numberOfEpisodes/seasons só vêm preenchidos
// quando a série já foi cacheada via detalhe — a busca da TMDB não traz
// esse dado.
export const SeriesSummarySchema = z.object({
  tmdbId: z.number().int(),
  name: z.string(),
  posterUrl: z.url().nullable(),
  firstAirDate: z.iso.date().nullable(),
  genres: z.array(z.string()),
  numberOfSeasons: z.number().int().nullable(),
  numberOfEpisodes: z.number().int().nullable(),
  seasons: z.array(SeriesSeasonSummarySchema).nullable(),
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

export const SeriesDetailSchema = SeriesSummarySchema.extend({
  overview: z.string().nullable(),
});

export type SeriesDetail = z.infer<typeof SeriesDetailSchema>;

// Marcação do usuário para uma série específica — sem a `series` embutida
// (quem consome isso normalmente já sabe de qual série se trata pelo
// contexto da chamada). Ver SeriesEntryWithSeriesSchema para o caso de
// listas/feeds. Sem status — o controle é só "quais episódios foram
// assistidos" (ver SeriesEpisodeSchema/endpoints de temporada) + a nota.
// watchedEpisodeCount vem de uma contagem em series_episode_watch, não de
// uma coluna própria — permite mostrar "45/62" sem request extra.
export const SeriesEntrySchema = z.object({
  id: z.string(),
  rating: z.number().nullable(),
  watchedEpisodeCount: z.number().int(),
  // Favoritar só acontece pelos 4 slots fixos da home (ver SeriesFavoritesResponseSchema)
  // — null = essa série não está em nenhum dos 4 favoritos do usuário.
  favoriteSlot: FavoriteSlotNumberSchema.nullable(),
  review: z.string().nullable(),
  updatedAt: z.iso.datetime(),
});

export type SeriesEntry = z.infer<typeof SeriesEntrySchema>;

export const SeriesEntryWithSeriesSchema = SeriesEntrySchema.extend({
  series: SeriesSummarySchema,
});

export type SeriesEntryWithSeries = z.infer<typeof SeriesEntryWithSeriesSchema>;

export const SeriesDetailResponseSchema = z.object({
  series: SeriesDetailSchema,
  entry: SeriesEntrySchema.nullable(),
});

export type SeriesDetailResponse = z.infer<typeof SeriesDetailResponseSchema>;

export const UpsertSeriesEntryRequestSchema = z.object({
  rating: z.number().min(0).max(5).multipleOf(0.5).nullable().optional(),
  review: z.string().max(2000).nullable().optional(),
});

export type UpsertSeriesEntryRequest = z.infer<typeof UpsertSeriesEntryRequestSchema>;

// Corpo de PUT /api/series/favorites/:slot — o slot vai na URL, aqui só a
// série escolhida.
export const SetSeriesFavoriteSlotRequestSchema = z.object({
  tmdbId: z.number().int(),
});

export type SetSeriesFavoriteSlotRequest = z.infer<typeof SetSeriesFavoriteSlotRequestSchema>;

export const SeriesFavoriteSlotSchema = z.object({
  slot: FavoriteSlotNumberSchema,
  entry: SeriesEntryWithSeriesSchema.nullable(),
});

export type SeriesFavoriteSlot = z.infer<typeof SeriesFavoriteSlotSchema>;

export const SeriesFavoritesResponseSchema = z.object({
  slots: z.array(SeriesFavoriteSlotSchema).length(4),
});

export type SeriesFavoritesResponse = z.infer<typeof SeriesFavoritesResponseSchema>;

// "favorite" ordena/filtra por favoriteSlot (null = não favoritado). Sem
// "status" (não existe mais) nem "platform" (nunca existiu pra série).
export const SERIES_ENTRY_SORT_FIELDS = ["rating", "favorite", "updatedAt"] as const;

export const ListSeriesEntriesQuerySchema = z.object({
  favorite: z.coerce.boolean().optional(),
  sortBy: z.enum(SERIES_ENTRY_SORT_FIELDS).default("updatedAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(24),
});

export type ListSeriesEntriesQuery = z.infer<typeof ListSeriesEntriesQuerySchema>;

export const PaginatedSeriesEntriesResponseSchema = z.object({
  items: z.array(SeriesEntryWithSeriesSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});

export type PaginatedSeriesEntriesResponse = z.infer<typeof PaginatedSeriesEntriesResponseSchema>;

export const SeriesListSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  itemCount: z.number().int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type SeriesList = z.infer<typeof SeriesListSchema>;

export const SeriesListsResponseSchema = z.object({
  lists: z.array(SeriesListSchema),
});

export type SeriesListsResponse = z.infer<typeof SeriesListsResponseSchema>;

export const SeriesListDetailSchema = SeriesListSchema.extend({
  items: z.array(SeriesSummarySchema),
});

export type SeriesListDetail = z.infer<typeof SeriesListDetailSchema>;

export const CreateSeriesListRequestSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(300).nullable().optional(),
});

export type CreateSeriesListRequest = z.infer<typeof CreateSeriesListRequestSchema>;

export const UpdateSeriesListRequestSchema = CreateSeriesListRequestSchema.partial();

export type UpdateSeriesListRequest = z.infer<typeof UpdateSeriesListRequestSchema>;

// Um episódio dentro de uma temporada — buscado ao vivo na TMDB a cada
// abertura de tela (sem cache local de nome/data/still, só o "watched" é
// nosso). Ver GET /api/series/:tmdbId/seasons/:seasonNumber.
export const SeriesEpisodeSchema = z.object({
  episodeNumber: z.number().int(),
  name: z.string(),
  airDate: z.iso.date().nullable(),
  stillUrl: z.url().nullable(),
  watched: z.boolean(),
});

export type SeriesEpisode = z.infer<typeof SeriesEpisodeSchema>;

export const SeriesSeasonEpisodesResponseSchema = z.object({
  seasonNumber: z.number().int(),
  episodes: z.array(SeriesEpisodeSchema),
});

export type SeriesSeasonEpisodesResponse = z.infer<typeof SeriesSeasonEpisodesResponseSchema>;

// Corpo de PUT .../episodes/:season/:episode e PUT .../seasons/:season —
// mesmo formato pros dois casos (episódio único ou temporada inteira).
export const SetWatchedRequestSchema = z.object({
  watched: z.boolean(),
});

export type SetWatchedRequest = z.infer<typeof SetWatchedRequestSchema>;

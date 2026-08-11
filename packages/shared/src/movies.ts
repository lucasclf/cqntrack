import { z } from "zod";
import { FavoriteSlotNumberSchema } from "./favorites";

// DTO enxuto de um filme — nunca a entity Drizzle crua. `rating` aqui é a
// nota agregada da própria TMDB (0-10) — não confundir com a nota pessoal do
// usuário (0-5), que vive em MovieEntrySchema. `runtime` (minutos) só vem
// preenchido quando o filme já foi cacheado via detalhe — a busca da TMDB
// não traz esse dado. Sem equivalente a "seasons": filme não tem substrutura.
export const MovieSummarySchema = z.object({
  tmdbId: z.number().int(),
  name: z.string(),
  posterUrl: z.url().nullable(),
  releaseDate: z.iso.date().nullable(),
  genres: z.array(z.string()),
  runtime: z.number().int().nullable(),
  rating: z.number().nullable(),
});

export type MovieSummary = z.infer<typeof MovieSummarySchema>;

export const SearchMoviesQuerySchema = z.object({
  q: z.string().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type SearchMoviesQuery = z.infer<typeof SearchMoviesQuerySchema>;

export const SearchMoviesResponseSchema = z.object({
  results: z.array(MovieSummarySchema),
});

export type SearchMoviesResponse = z.infer<typeof SearchMoviesResponseSchema>;

export const MovieDetailSchema = MovieSummarySchema.extend({
  overview: z.string().nullable(),
});

export type MovieDetail = z.infer<typeof MovieDetailSchema>;

// Marcação do usuário para um filme específico — sem o `movie` embutido
// (quem consome isso normalmente já sabe de qual filme se trata pelo
// contexto da chamada). Ver MovieEntryWithMovieSchema para o caso de
// listas/feeds. Sem status — filme não tem substrutura pra progredir, só
// "assisti ou não" (watchedAt) + a nota. watchedAt é a fonte de verdade;
// `watched` não existe como coluna própria — quem consome deriva
// `watchedAt !== null`.
export const MovieEntrySchema = z.object({
  id: z.string(),
  rating: z.number().nullable(),
  watchedAt: z.iso.datetime().nullable(),
  // Favoritar só acontece pelos 4 slots fixos da home (ver MovieFavoritesResponseSchema)
  // — null = esse filme não está em nenhum dos 4 favoritos do usuário.
  favoriteSlot: FavoriteSlotNumberSchema.nullable(),
  review: z.string().nullable(),
  updatedAt: z.iso.datetime(),
});

export type MovieEntry = z.infer<typeof MovieEntrySchema>;

export const MovieEntryWithMovieSchema = MovieEntrySchema.extend({
  movie: MovieSummarySchema,
});

export type MovieEntryWithMovie = z.infer<typeof MovieEntryWithMovieSchema>;

export const MovieDetailResponseSchema = z.object({
  movie: MovieDetailSchema,
  entry: MovieEntrySchema.nullable(),
});

export type MovieDetailResponse = z.infer<typeof MovieDetailResponseSchema>;

// `watched` no corpo é um toggle explícito, independente de rating/review:
// true seta watchedAt=now (no servidor), false limpa. Omitido = não mexe.
export const UpsertMovieEntryRequestSchema = z.object({
  rating: z.number().min(0).max(5).multipleOf(0.5).nullable().optional(),
  review: z.string().max(2000).nullable().optional(),
  watched: z.boolean().optional(),
});

export type UpsertMovieEntryRequest = z.infer<typeof UpsertMovieEntryRequestSchema>;

// Corpo de PUT /api/movies/favorites/:slot — o slot vai na URL, aqui só o
// filme escolhido.
export const SetMovieFavoriteSlotRequestSchema = z.object({
  tmdbId: z.number().int(),
});

export type SetMovieFavoriteSlotRequest = z.infer<typeof SetMovieFavoriteSlotRequestSchema>;

export const MovieFavoriteSlotSchema = z.object({
  slot: FavoriteSlotNumberSchema,
  entry: MovieEntryWithMovieSchema.nullable(),
});

export type MovieFavoriteSlot = z.infer<typeof MovieFavoriteSlotSchema>;

export const MovieFavoritesResponseSchema = z.object({
  slots: z.array(MovieFavoriteSlotSchema).length(4),
});

export type MovieFavoritesResponse = z.infer<typeof MovieFavoritesResponseSchema>;

// "favorite" ordena/filtra por favoriteSlot (null = não favoritado). Sem
// "status" (filme não tem) nem "platform" (nunca existiu fora de jogos).
export const MOVIE_ENTRY_SORT_FIELDS = ["rating", "favorite", "updatedAt"] as const;

export const ListMovieEntriesQuerySchema = z.object({
  favorite: z.coerce.boolean().optional(),
  // Filtro extra que série não tem (não faz sentido lá): só os já
  // assistidos, ou só os ainda não assistidos.
  watched: z.coerce.boolean().optional(),
  sortBy: z.enum(MOVIE_ENTRY_SORT_FIELDS).default("updatedAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(24),
});

export type ListMovieEntriesQuery = z.infer<typeof ListMovieEntriesQuerySchema>;

export const PaginatedMovieEntriesResponseSchema = z.object({
  items: z.array(MovieEntryWithMovieSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});

export type PaginatedMovieEntriesResponse = z.infer<typeof PaginatedMovieEntriesResponseSchema>;

export const MovieListSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  itemCount: z.number().int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type MovieList = z.infer<typeof MovieListSchema>;

export const MovieListsResponseSchema = z.object({
  lists: z.array(MovieListSchema),
});

export type MovieListsResponse = z.infer<typeof MovieListsResponseSchema>;

export const MovieListDetailSchema = MovieListSchema.extend({
  items: z.array(MovieSummarySchema),
});

export type MovieListDetail = z.infer<typeof MovieListDetailSchema>;

export const CreateMovieListRequestSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(300).nullable().optional(),
});

export type CreateMovieListRequest = z.infer<typeof CreateMovieListRequestSchema>;

export const UpdateMovieListRequestSchema = CreateMovieListRequestSchema.partial();

export type UpdateMovieListRequest = z.infer<typeof UpdateMovieListRequestSchema>;

import { z } from "zod";
import { CastMemberSchema, CrewMemberSchema } from "./credits";

// Fonte única de verdade dos 2 status — importado tanto pelo schema Drizzle
// (enum da coluna) quanto pelo z.enum abaixo. Diferente de série (sem
// status, só watchedEpisodeCount): filme não tem substrutura, então o
// status é só "já vi"/"quero ver" — sem os estados intermediários que jogo
// tem (jogando/abandonado).
export const MOVIE_STATUSES = ["watched", "want_to_watch"] as const;

export const MovieStatusSchema = z.enum(MOVIE_STATUSES);

export type MovieStatus = z.infer<typeof MovieStatusSchema>;

export const MOVIE_STATUS_LABELS: Record<MovieStatus, string> = {
  watched: "Já vi",
  want_to_watch: "Quero ver",
};

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

// Tela "Descobrir" (populares da própria TMDB, GET /movie/popular) — vira o
// índice da seção de filmes no menu superior. Sem contagem total (a TMDB
// não garante um número exato útil) — "hasMore" é aproximado: true quando a
// página veio cheia, false quando veio incompleta (fim da lista).
export const DiscoverMoviesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(500).default(1),
});

export type DiscoverMoviesQuery = z.infer<typeof DiscoverMoviesQuerySchema>;

export const DiscoverMoviesResponseSchema = z.object({
  results: z.array(MovieSummarySchema),
  page: z.number().int(),
  hasMore: z.boolean(),
});

export type DiscoverMoviesResponse = z.infer<typeof DiscoverMoviesResponseSchema>;

export const MovieDetailSchema = MovieSummarySchema.extend({
  overview: z.string().nullable(),
  cast: z.array(CastMemberSchema),
  directors: z.array(CrewMemberSchema),
});

export type MovieDetail = z.infer<typeof MovieDetailSchema>;

// Marcação do usuário para um filme específico — sem o `movie` embutido
// (quem consome isso normalmente já sabe de qual filme se trata pelo
// contexto da chamada). Ver MovieEntryWithMovieSchema para o caso de
// listas/feeds. `watchedAt` é derivado do status (preenchido só quando
// status vira "watched") — continua existindo pra mostrar "Assistido em
// DD/MM/AAAA", mas quem decide o valor é o status, não um toggle
// independente.
export const MovieEntrySchema = z.object({
  id: z.string(),
  status: MovieStatusSchema.nullable(),
  rating: z.number().nullable(),
  watchedAt: z.iso.datetime().nullable(),
  // Favoritar não tem mais limite de quantidade (ver MovieFavoritesResponseSchema)
  // — null = esse filme não está favoritado.
  favoritedAt: z.iso.datetime().nullable(),
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

// `favorited` no corpo é um toggle explícito, independente de rating/review/
// status: true seta favoritedAt=now (no servidor), false limpa. Omitido =
// não mexe — mesmo espírito de status (transição explícita, não implícita).
export const UpsertMovieEntryRequestSchema = z.object({
  status: MovieStatusSchema.nullable().optional(),
  rating: z.number().min(0).max(5).multipleOf(0.5).nullable().optional(),
  review: z.string().max(2000).nullable().optional(),
  favorited: z.boolean().optional(),
});

export type UpsertMovieEntryRequest = z.infer<typeof UpsertMovieEntryRequestSchema>;

// Sem limite de quantidade (não é mais um pool de 4 slots) — lista dos
// favoritos do usuário, já ordenada por favoritedAt decrescente (mais
// recente primeiro) pelo service, não pelo cliente.
export const MovieFavoritesResponseSchema = z.object({
  items: z.array(MovieEntryWithMovieSchema),
});

export type MovieFavoritesResponse = z.infer<typeof MovieFavoritesResponseSchema>;

// "favorite" ordena/filtra por favoritedAt (null = não favoritado).
export const MOVIE_ENTRY_SORT_FIELDS = ["status", "rating", "favorite", "updatedAt"] as const;

export const ListMovieEntriesQuerySchema = z.object({
  status: MovieStatusSchema.optional(),
  favorite: z.coerce.boolean().optional(),
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

// Importação de CSV do Filmow ("Conta" > "Importar dados") — o export do
// Filmow é só uma coluna "Title" (sem ano/nota/data), então o match é por
// título de texto na TMDB, pegando o 1º resultado (mais relevante segundo a
// própria TMDB) — sem heurística de desambiguação além disso. Cada título
// processado vira uma marcação "Já vi" quando encontrado. Lote pequeno
// (server-side, além do que o front já manda em lotes) pra não estourar o
// limite de 50 subrequests externos por invocação do plano Free de Workers
// — cada título novo custa até 4 (busca + detalhe em pt-BR + detalhe em
// en-US, só quando o filme não tem sinopse pt-BR cadastrada na TMDB, ver
// getMovieById + créditos), então 10 por request fica com folga real do
// teto mesmo se nenhum filme do lote já estiver cacheado.
export const ImportFilmowRequestSchema = z.object({
  titles: z.array(z.string().min(1).max(300)).min(1).max(10),
});

export type ImportFilmowRequest = z.infer<typeof ImportFilmowRequestSchema>;

export const ImportFilmowResultSchema = z.object({
  title: z.string(),
  status: z.enum(["imported", "not_found", "error"]),
  movie: MovieSummarySchema.nullable(),
});

export type ImportFilmowResult = z.infer<typeof ImportFilmowResultSchema>;

export const ImportFilmowResponseSchema = z.object({
  results: z.array(ImportFilmowResultSchema),
});

// O import em si não gera activity por título (floodaria o feed com
// centenas de "status_changed" de uma vez, ver logActivity: false em
// upsertMovieEntry) — o front chama essa rota separada 1x, ao final do
// loop de import, só com a contagem final, gerando 1 única entrada-resumo
// no feed.
export const LogFilmowImportActivityRequestSchema = z.object({
  importedCount: z.number().int().min(0),
});

export type LogFilmowImportActivityRequest = z.infer<typeof LogFilmowImportActivityRequestSchema>;

export type ImportFilmowResponse = z.infer<typeof ImportFilmowResponseSchema>;

// Importação a partir do Trakt ("Conta" > "Importar dados", só perfil
// público por enquanto) — diferente do Filmow, o Trakt tem API própria
// (api.trakt.tv) e já devolve o tmdb_id de cada filme assistido (ver
// integrations/trakt/client.ts no backend), então não precisa de busca por
// texto na TMDB. `rating` já vem convertido da escala 1-10 do Trakt pra
// 0-5 em meio-ponto (mesma escala de UpsertMovieEntryRequestSchema).
export const ImportTraktMoviesQuerySchema = z.object({
  username: z.string().min(1).max(50),
});

export type ImportTraktMoviesQuery = z.infer<typeof ImportTraktMoviesQuerySchema>;

export const TraktImportableMovieSchema = z.object({
  tmdbId: z.number().int(),
  title: z.string(),
  rating: z.number().min(0).max(5).multipleOf(0.5).nullable(),
});

export type TraktImportableMovie = z.infer<typeof TraktImportableMovieSchema>;

// Filme assistido no Trakt sem ids.tmdb (raro — títulos muito obscuros/
// regionais) — sem busca de desambiguação por texto (mesmo nível de
// esforço que o Filmow já aceita pros próprios "not_found").
export const TraktNotFoundMovieSchema = z.object({
  title: z.string(),
});

export const TraktMoviesPreviewResponseSchema = z.object({
  importable: z.array(TraktImportableMovieSchema),
  notFound: z.array(TraktNotFoundMovieSchema),
});

export type TraktMoviesPreviewResponse = z.infer<typeof TraktMoviesPreviewResponseSchema>;

export const ImportTraktMoviesRequestSchema = z.object({
  items: z
    .array(
      z.object({
        tmdbId: z.number().int(),
        title: z.string().min(1).max(300),
        rating: z.number().min(0).max(5).multipleOf(0.5).nullable(),
      }),
    )
    .min(1)
    .max(10),
});

export type ImportTraktMoviesRequest = z.infer<typeof ImportTraktMoviesRequestSchema>;

export const ImportTraktMovieResultSchema = z.object({
  tmdbId: z.number().int(),
  title: z.string(),
  status: z.enum(["imported", "error"]),
});

export type ImportTraktMovieResult = z.infer<typeof ImportTraktMovieResultSchema>;

export const ImportTraktMoviesResponseSchema = z.object({
  results: z.array(ImportTraktMovieResultSchema),
});

export type ImportTraktMoviesResponse = z.infer<typeof ImportTraktMoviesResponseSchema>;

// Mesmo racional de LogFilmowImportActivityRequestSchema.
export const LogTraktMoviesImportActivityRequestSchema = z.object({
  importedCount: z.number().int().min(0),
});

export type LogTraktMoviesImportActivityRequest = z.infer<
  typeof LogTraktMoviesImportActivityRequestSchema
>;

import { z } from "zod";
import { CastMemberSchema, CrewMemberSchema, SeriesDirectorSchema } from "./credits";

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

// Mesmo espírito de DiscoverMoviesResponseSchema (filme) — populares da
// própria TMDB (GET /tv/popular), índice da seção de séries no menu superior.
export const DiscoverSeriesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(500).default(1),
});

export type DiscoverSeriesQuery = z.infer<typeof DiscoverSeriesQuerySchema>;

export const DiscoverSeriesResponseSchema = z.object({
  results: z.array(SeriesSummarySchema),
  page: z.number().int(),
  hasMore: z.boolean(),
});

export type DiscoverSeriesResponse = z.infer<typeof DiscoverSeriesResponseSchema>;

export const SeriesDetailSchema = SeriesSummarySchema.extend({
  overview: z.string().nullable(),
  cast: z.array(CastMemberSchema),
  // Criador/showrunner (created_by da TMDB) — não é a mesma coisa que
  // "Direção" (diretores mais frequentes por episódio, ver `directors`
  // abaixo). Série não tem um diretor único como filme.
  creators: z.array(CrewMemberSchema),
  directors: z.array(SeriesDirectorSchema),
});

export type SeriesDetail = z.infer<typeof SeriesDetailSchema>;

// Episódio "resumido" — usado tanto pro já disponível quanto pro previsto
// (ver availableEpisode/upcomingEpisode abaixo), mesmo shape pros dois.
export const SeriesUpcomingEpisodeSchema = z.object({
  seasonNumber: z.number().int(),
  episodeNumber: z.number().int(),
  name: z.string(),
  airDate: z.iso.date(),
});

export type SeriesUpcomingEpisode = z.infer<typeof SeriesUpcomingEpisodeSchema>;

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
  // Favoritar não tem mais limite de quantidade (ver SeriesFavoritesResponseSchema)
  // — null = essa série não está favoritada.
  favoritedAt: z.iso.datetime().nullable(),
  // null = não abandonada. Só tira a série de "Continuar assistindo" (ver
  // getContinueWatching no backend) — não mexe no progresso já registrado.
  abandonedAt: z.iso.datetime().nullable(),
  review: z.string().nullable(),
  updatedAt: z.iso.datetime(),
  // Último episódio lançado (segundo a TMDB) que esse usuário ainda não
  // marcou como assistido — null quando não há episódio lançado pendente
  // (já assistiu o mais recente, ou a série não tem episódio lançado
  // ainda). Refeito pelo cron diário + toda revalidação do cache da série
  // (ver refresh-episodes.job.ts / series.service.ts).
  availableEpisode: SeriesUpcomingEpisodeSchema.nullable(),
  // Próximo episódio previsto, com data futura — null quando a TMDB não
  // tem previsão (série encerrada, ou hiato sem data anunciada ainda).
  upcomingEpisode: SeriesUpcomingEpisodeSchema.nullable(),
});

export type SeriesEntry = z.infer<typeof SeriesEntrySchema>;

export const SeriesEntryWithSeriesSchema = SeriesEntrySchema.extend({
  series: SeriesSummarySchema,
});

export type SeriesEntryWithSeries = z.infer<typeof SeriesEntryWithSeriesSchema>;

export const SeriesDetailResponseSchema = z.object({
  series: SeriesDetailSchema,
  entry: SeriesEntrySchema.nullable(),
  // Primeira temporada (em ordem) com episódios assistidos < episodeCount
  // já cacheado (sem chamada à TMDB — cálculo aproximado, só pra escolher
  // a aba padrão, diferente do getContinueWatching que resolve o episódio
  // exato). null quando não há entry, ou quando tudo já foi assistido (aí
  // o front cai no padrão de sempre, Temporada 1).
  nextSeasonToWatch: z.number().int().nullable(),
});

export type SeriesDetailResponse = z.infer<typeof SeriesDetailResponseSchema>;

export const UpsertSeriesEntryRequestSchema = z.object({
  rating: z.number().min(0).max(5).multipleOf(0.5).nullable().optional(),
  review: z.string().max(2000).nullable().optional(),
  favorited: z.boolean().optional(),
  abandoned: z.boolean().optional(),
});

export type UpsertSeriesEntryRequest = z.infer<typeof UpsertSeriesEntryRequestSchema>;

// Sem limite de quantidade (não é mais um pool de 4 slots) — lista dos
// favoritos do usuário, já ordenada por favoritedAt decrescente (mais
// recente primeiro) pelo service, não pelo cliente.
export const SeriesFavoritesResponseSchema = z.object({
  items: z.array(SeriesEntryWithSeriesSchema),
});

export type SeriesFavoritesResponse = z.infer<typeof SeriesFavoritesResponseSchema>;

// "favorite" ordena/filtra por favoritedAt (null = não favoritado). Sem
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

// Item da Home ("Continuar assistindo") — calculado ao vivo a cada
// carregamento (ver continue-watching.service.ts no BE), não uma marcação
// qualquer: só existe pra série com episódio pendente de verdade.
// `recentlyActive` = assistiu algum episódio dessa série nos últimos 3
// meses (critério de ordenação, não de filtro).
export const ContinueWatchingItemSchema = z.object({
  series: SeriesSummarySchema,
  nextEpisode: SeriesUpcomingEpisodeSchema,
  recentlyActive: z.boolean(),
});

export type ContinueWatchingItem = z.infer<typeof ContinueWatchingItemSchema>;

// Paginação por cursor (índice na lista já ordenada de séries candidatas,
// não um id) — a ordenação em si usa só dado já em cache local (sem TMDB),
// pra ficar estável entre páginas; só a resolução do episódio exato de
// cada item da página consulta a TMDB. `nextCursor: null` = não há mais
// candidatas (chegou ao fim da lista, não necessariamente da página).
export const ContinueWatchingQuerySchema = z.object({
  cursor: z.coerce.number().int().min(0).default(0),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
});

export type ContinueWatchingQuery = z.infer<typeof ContinueWatchingQuerySchema>;

export const ContinueWatchingResponseSchema = z.object({
  items: z.array(ContinueWatchingItemSchema),
  nextCursor: z.number().int().nullable(),
});

export type ContinueWatchingResponse = z.infer<typeof ContinueWatchingResponseSchema>;

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

// Detalhe completo de UM episódio (página própria) — diferente de
// SeriesEpisodeSchema (usado na lista da temporada, sem sinopse/duração/
// diretor). `directors` é quem dirigiu especificamente esse episódio, não
// os diretores mais frequentes da série inteira (ver SeriesDirectorSchema,
// usado em SeriesDetailSchema).
export const SeriesEpisodeDetailSchema = z.object({
  seasonNumber: z.number().int(),
  episodeNumber: z.number().int(),
  name: z.string(),
  overview: z.string().nullable(),
  airDate: z.iso.date().nullable(),
  stillUrl: z.url().nullable(),
  runtime: z.number().int().nullable(),
  rating: z.number().nullable(),
  watched: z.boolean(),
  directors: z.array(CrewMemberSchema),
});

export type SeriesEpisodeDetail = z.infer<typeof SeriesEpisodeDetailSchema>;

// Série não tem status pra filtrar "recente" (diferente de filme/livro/
// jogo) — o sinal mais próximo é o episódio assistido mais recentemente
// (MAX(watchedAt) em series_episode_watch, agregado por série). Usado só
// pela seção "Assistido recentemente" do perfil público.
export const RecentlyWatchedSeriesItemSchema = z.object({
  series: SeriesSummarySchema,
  lastWatchedAt: z.iso.datetime(),
});

export type RecentlyWatchedSeriesItem = z.infer<typeof RecentlyWatchedSeriesItemSchema>;

// Paginado (page/pageSize/total) — tanto a seção "Assistido recentemente"
// (perfil, pageSize=12) quanto a listagem completa de "séries acompanhadas"
// (clicável a partir da estatística "N séries acompanhadas" do perfil)
// reaproveitam o mesmo endpoint/schema.
export const RecentlyWatchedSeriesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(12),
});

export type RecentlyWatchedSeriesQuery = z.infer<typeof RecentlyWatchedSeriesQuerySchema>;

export const RecentlyWatchedSeriesResponseSchema = z.object({
  items: z.array(RecentlyWatchedSeriesItemSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});

export type RecentlyWatchedSeriesResponse = z.infer<typeof RecentlyWatchedSeriesResponseSchema>;

// Importação de CSV do tvtime ("Conta" > "Importar dados") — diferente do
// Filmow (1 linha = 1 filme), o export do tvtime é por EPISÓDIO (uma linha
// por episódio de cada série), então o front agrupa por série antes de
// mandar: 1 request = 1 série inteira, com todos os episódios assistidos
// dela. `season`/`episode` vêm direto do CSV, sem validar contra a TMDB
// (mesma confiança que setEpisodeWatched já deposita no toggle manual de 1
// episódio). `watchedAt` vem do `watched_at` do tvtime — ausente/omitido
// cai no default do banco (momento do import, ver series_episode_watch).
export const ImportTvTimeEpisodeSchema = z.object({
  season: z.number().int().min(0),
  episode: z.number().int().min(1),
  watchedAt: z.iso.datetime().nullable().optional(),
});

export type ImportTvTimeEpisode = z.infer<typeof ImportTvTimeEpisodeSchema>;

export const ImportTvTimeRequestSchema = z.object({
  seriesTvdbId: z.number().int().positive(),
  title: z.string().min(1).max(300),
  episodes: z.array(ImportTvTimeEpisodeSchema).min(1).max(5000),
});

export type ImportTvTimeRequest = z.infer<typeof ImportTvTimeRequestSchema>;

export const ImportTvTimeResponseSchema = z.object({
  seriesTvdbId: z.number().int(),
  title: z.string(),
  status: z.enum(["imported", "not_found", "error"]),
  episodesImported: z.number().int(),
});

export type ImportTvTimeResponse = z.infer<typeof ImportTvTimeResponseSchema>;

// Mesmo racional de LogFilmowImportActivityRequestSchema (movies.ts): o
// import por série não gera activity individual (ver import.service.ts) —
// o front chama essa rota 1x, ao final do loop de import, com o total
// agregado, gerando 1 única entrada-resumo no feed.
export const LogTvTimeImportActivityRequestSchema = z.object({
  importedSeriesCount: z.number().int().min(0),
  importedEpisodeCount: z.number().int().min(0),
});

export type LogTvTimeImportActivityRequest = z.infer<typeof LogTvTimeImportActivityRequestSchema>;

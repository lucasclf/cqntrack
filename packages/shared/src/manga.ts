import { z } from "zod";

// Fonte única de verdade dos 4 status — importado tanto pelo schema Drizzle
// (enum da coluna) quanto pelo z.enum abaixo. Mesmo modelo de livro (leitura,
// com estado intermediário "lendo"), diferente de série (sem status "de
// verdade", só progresso por capítulo) — mangá tem as duas coisas: status
// manual (aqui) + progresso granular por capítulo (ver MangaChapterSchema).
export const MANGA_STATUSES = ["want_to_read", "reading", "read", "dropped"] as const;

export const MangaStatusSchema = z.enum(MANGA_STATUSES);

export type MangaStatus = z.infer<typeof MangaStatusSchema>;

export const MANGA_STATUS_LABELS: Record<MangaStatus, string> = {
  want_to_read: "Quero ler",
  reading: "Lendo",
  read: "Lido",
  dropped: "Abandonado",
};

// Status de PUBLICAÇÃO do mangá segundo a própria MangaDex (ongoing/
// completed/hiatus/cancelled) — não confundir com MangaStatus acima, que é
// o status de LEITURA do usuário.
export const MANGA_PUBLICATION_STATUSES = ["ongoing", "completed", "hiatus", "cancelled"] as const;

export const MangaPublicationStatusSchema = z.enum(MANGA_PUBLICATION_STATUSES);

export type MangaPublicationStatus = z.infer<typeof MangaPublicationStatusSchema>;

// Diferente de livro (Google Books não tem ID de autor — AuthorBooksResponseSchema
// só guarda o nome), a MangaDex tem um recurso de autor de verdade (GET
// /author/:id) — guardar o id junto do nome permite linkar pra
// /mangas/autores/:id direto da tela de detalhe, sem busca textual.
export const MangaAuthorRefSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export type MangaAuthorRef = z.infer<typeof MangaAuthorRefSchema>;

// DTO enxuto de um mangá — nunca a entity Drizzle crua. `mangadexId` é string
// (MangaDex usa UUID, diferente de igdbId/tmdbId, que são inteiros). Sem
// `rating`: a nota agregada do MangaDex vive num endpoint de estatísticas
// separado (1 request a mais por item) — não vale o custo só pra mostrar na
// busca/listagem, igual `numberOfChapters` (ver MangaVolumesResponseSchema,
// buscado ao vivo só na tela de detalhe).
export const MangaSummarySchema = z.object({
  mangadexId: z.string(),
  title: z.string(),
  coverUrl: z.url().nullable(),
  authors: z.array(MangaAuthorRefSchema),
  tags: z.array(z.string()),
  publicationStatus: MangaPublicationStatusSchema.nullable(),
  year: z.number().int().nullable(),
});

export type MangaSummary = z.infer<typeof MangaSummarySchema>;

// Marcação do usuário para um mangá específico — sem o `manga` embutido (quem
// consome isso normalmente já sabe de qual mangá se trata pelo contexto da
// chamada). Ver MangaEntryWithMangaSchema para o caso de listas/feeds.
// readChapterCount vem de uma contagem em manga_chapter_read, não de uma
// coluna própria — permite mostrar "23/145" sem request extra, mesmo padrão
// de watchedEpisodeCount em SeriesEntrySchema.
export const MangaEntrySchema = z.object({
  id: z.string(),
  status: MangaStatusSchema.nullable(),
  rating: z.number().nullable(),
  readChapterCount: z.number().int(),
  // Favoritar não tem limite de quantidade — null = esse mangá não está
  // favoritado.
  favoritedAt: z.iso.datetime().nullable(),
  review: z.string().nullable(),
  updatedAt: z.iso.datetime(),
});

export type MangaEntry = z.infer<typeof MangaEntrySchema>;

export const MangaEntryWithMangaSchema = MangaEntrySchema.extend({
  manga: MangaSummarySchema,
});

export type MangaEntryWithManga = z.infer<typeof MangaEntryWithMangaSchema>;

// Mesmo MangaSummary, com a marcação do usuário logado embutida quando
// existir (null quando o mangá nunca foi marcado) — usado em telas que
// listam vários mangás de fontes externas (busca, descobrir, detalhe de
// lista) e agora também precisam saber o que o usuário já marcou, pras
// ações rápidas do Card. Apesar de mangá ter status (diferente de série),
// "marcar" no Card dispara o endpoint bulk (read-all) com confirmação, não
// um toggle de status — mesma decisão de produto de SeriesSummaryWithEntry,
// pra "marcar lido" significar de fato "li os capítulos", não só rotular.
export const MangaSummaryWithEntrySchema = MangaSummarySchema.extend({
  entry: MangaEntrySchema.nullable(),
});

export type MangaSummaryWithEntry = z.infer<typeof MangaSummaryWithEntrySchema>;

export const SearchMangaQuerySchema = z.object({
  q: z.string().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(40).default(20),
});

export type SearchMangaQuery = z.infer<typeof SearchMangaQuerySchema>;

export const SearchMangaResponseSchema = z.object({
  results: z.array(MangaSummaryWithEntrySchema),
});

export type SearchMangaResponse = z.infer<typeof SearchMangaResponseSchema>;

// Mesmo espírito de DiscoverSeriesResponseSchema — populares de verdade via
// GET /manga?order[followedCount]=desc (confirmado funcionando na API real).
// Diferente de livro, que não tem Discover (Google Books não suporta).
export const DiscoverMangaQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(500).default(1),
});

export type DiscoverMangaQuery = z.infer<typeof DiscoverMangaQuerySchema>;

export const DiscoverMangaResponseSchema = z.object({
  results: z.array(MangaSummaryWithEntrySchema),
  page: z.number().int(),
  hasMore: z.boolean(),
});

export type DiscoverMangaResponse = z.infer<typeof DiscoverMangaResponseSchema>;

export const MangaDetailSchema = MangaSummarySchema.extend({
  description: z.string().nullable(),
});

export type MangaDetail = z.infer<typeof MangaDetailSchema>;

export const MangaDetailResponseSchema = z.object({
  manga: MangaDetailSchema,
  entry: MangaEntrySchema.nullable(),
});

export type MangaDetailResponse = z.infer<typeof MangaDetailResponseSchema>;

export const UpsertMangaEntryRequestSchema = z.object({
  status: MangaStatusSchema.nullable().optional(),
  rating: z.number().min(0).max(5).multipleOf(0.5).nullable().optional(),
  review: z.string().max(2000).nullable().optional(),
  favorited: z.boolean().optional(),
});

export type UpsertMangaEntryRequest = z.infer<typeof UpsertMangaEntryRequestSchema>;

// Sem limite de quantidade — lista dos favoritos do usuário, já ordenada por
// favoritedAt decrescente (mais recente primeiro) pelo service.
export const MangaFavoritesResponseSchema = z.object({
  items: z.array(MangaEntryWithMangaSchema),
});

export type MangaFavoritesResponse = z.infer<typeof MangaFavoritesResponseSchema>;

export const MANGA_ENTRY_SORT_FIELDS = ["status", "rating", "favorite", "updatedAt"] as const;

export const ListMangaEntriesQuerySchema = z.object({
  status: MangaStatusSchema.optional(),
  favorite: z.coerce.boolean().optional(),
  sortBy: z.enum(MANGA_ENTRY_SORT_FIELDS).default("updatedAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(24),
});

export type ListMangaEntriesQuery = z.infer<typeof ListMangaEntriesQuerySchema>;

export const PaginatedMangaEntriesResponseSchema = z.object({
  items: z.array(MangaEntryWithMangaSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});

export type PaginatedMangaEntriesResponse = z.infer<typeof PaginatedMangaEntriesResponseSchema>;

export const MangaListSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  itemCount: z.number().int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type MangaList = z.infer<typeof MangaListSchema>;

export const MangaListsResponseSchema = z.object({
  lists: z.array(MangaListSchema),
});

export type MangaListsResponse = z.infer<typeof MangaListsResponseSchema>;

// items com entry embutida — mesmo racional de GameListDetailSchema
// (reaproveitado tanto pela rota autenticada quanto pela de perfil público,
// entry = de quem for dono da lista em cada caso).
export const MangaListDetailSchema = MangaListSchema.extend({
  items: z.array(MangaSummaryWithEntrySchema),
});

export type MangaListDetail = z.infer<typeof MangaListDetailSchema>;

export const CreateMangaListRequestSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(300).nullable().optional(),
});

export type CreateMangaListRequest = z.infer<typeof CreateMangaListRequestSchema>;

export const UpdateMangaListRequestSchema = CreateMangaListRequestSchema.partial();

export type UpdateMangaListRequest = z.infer<typeof UpdateMangaListRequestSchema>;

// Diferente de AuthorBooksResponseSchema (livro, sem ID de autor de
// verdade — a Google Books só permite busca textual): MangaDex tem um
// endpoint de autor de verdade (GET /author/:id), então dá pra devolver o
// nome já resolvido pela própria API em vez de ecoar o parâmetro da rota.
export const AuthorMangaResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  manga: z.array(MangaSummarySchema),
});

export type AuthorMangaResponse = z.infer<typeof AuthorMangaResponseSchema>;

// Um capítulo dentro de um volume — buscado ao vivo do MangaDex a cada
// abertura de tela (sem cache local, só o "read" é nosso, ver
// manga_chapter_read). `chapterNumber` é number (não int): a MangaDex aceita
// capítulo decimal (ex. "10.5", extra/bônus fora da numeração principal).
export const MangaChapterSchema = z.object({
  chapterNumber: z.number(),
  mangadexChapterId: z.string(),
  read: z.boolean(),
});

export type MangaChapter = z.infer<typeof MangaChapterSchema>;

// `volumeNumber: 0` é o sentinela de "sem volume" (a MangaDex agrupa
// capítulo avulso sob a chave "none") — ver db/schema/manga.schema.ts pro
// racional completo de por que não é `null` (índice único trata cada NULL
// como distinto no SQLite, o que quebraria a garantia de 1 linha por
// capítulo).
export const MangaVolumeSchema = z.object({
  volumeNumber: z.number().int(),
  chapters: z.array(MangaChapterSchema),
});

export type MangaVolume = z.infer<typeof MangaVolumeSchema>;

export const MangaVolumesResponseSchema = z.object({
  volumes: z.array(MangaVolumeSchema),
});

export type MangaVolumesResponse = z.infer<typeof MangaVolumesResponseSchema>;

// Corpo de PUT .../chapters/:volume/:chapter e PUT .../volumes/:volume —
// mesmo formato pros dois casos (capítulo único ou volume inteiro), mesmo
// espírito de SetWatchedRequestSchema (série).
export const SetChapterReadRequestSchema = z.object({
  read: z.boolean(),
});

export type SetChapterReadRequest = z.infer<typeof SetChapterReadRequestSchema>;

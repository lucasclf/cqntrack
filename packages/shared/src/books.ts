import { z } from "zod";
import { FavoriteSlotNumberSchema } from "./favorites";

// Fonte única de verdade dos 4 status — importado tanto pelo schema Drizzle
// (enum da coluna) quanto pelo z.enum abaixo. Mesmo modelo de jogos (status),
// diferente de série/filme (progresso/toggle) — decisão explícita do usuário.
export const BOOK_STATUSES = ["want_to_read", "reading", "read", "dropped"] as const;

export const BookStatusSchema = z.enum(BOOK_STATUSES);

export type BookStatus = z.infer<typeof BookStatusSchema>;

export const BOOK_STATUS_LABELS: Record<BookStatus, string> = {
  want_to_read: "Quero ler",
  reading: "Lendo",
  read: "Lido",
  dropped: "Abandonado",
};

// DTO enxuto de um livro — nunca a entity Drizzle crua. `googleBooksId` é
// string (diferente de igdbId/tmdbId, que são inteiros). `rating` aqui é a
// nota agregada da própria Google Books (0-5, averageRating); não confundir
// com a nota pessoal do usuário (0-5), que vive em BookEntrySchema — mesma
// escala, fontes diferentes. `publishedDate` fica como texto cru: a Google
// Books devolve datas parciais tipo "2020" ou "2020-05".
export const BookSummarySchema = z.object({
  googleBooksId: z.string(),
  title: z.string(),
  authors: z.array(z.string()),
  coverUrl: z.url().nullable(),
  publishedDate: z.string().nullable(),
  categories: z.array(z.string()),
  pageCount: z.number().int().nullable(),
  rating: z.number().nullable(),
});

export type BookSummary = z.infer<typeof BookSummarySchema>;

export const SearchBooksQuerySchema = z.object({
  q: z.string().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(40).default(20),
});

export type SearchBooksQuery = z.infer<typeof SearchBooksQuerySchema>;

export const SearchBooksResponseSchema = z.object({
  results: z.array(BookSummarySchema),
});

export type SearchBooksResponse = z.infer<typeof SearchBooksResponseSchema>;

export const BookDetailSchema = BookSummarySchema.extend({
  description: z.string().nullable(),
});

export type BookDetail = z.infer<typeof BookDetailSchema>;

// Marcação do usuário para um livro específico — sem o `book` embutido (quem
// consome isso normalmente já sabe de qual livro se trata pelo contexto da
// chamada). Ver BookEntryWithBookSchema para o caso de listas/feeds.
export const BookEntrySchema = z.object({
  id: z.string(),
  status: BookStatusSchema.nullable(),
  rating: z.number().nullable(),
  // Favoritar só acontece pelos 4 slots fixos da home (ver BookFavoritesResponseSchema)
  // — null = esse livro não está em nenhum dos 4 favoritos do usuário.
  favoriteSlot: FavoriteSlotNumberSchema.nullable(),
  review: z.string().nullable(),
  updatedAt: z.iso.datetime(),
});

export type BookEntry = z.infer<typeof BookEntrySchema>;

export const BookEntryWithBookSchema = BookEntrySchema.extend({
  book: BookSummarySchema,
});

export type BookEntryWithBook = z.infer<typeof BookEntryWithBookSchema>;

export const BookDetailResponseSchema = z.object({
  book: BookDetailSchema,
  entry: BookEntrySchema.nullable(),
});

export type BookDetailResponse = z.infer<typeof BookDetailResponseSchema>;

export const UpsertBookEntryRequestSchema = z.object({
  status: BookStatusSchema.nullable().optional(),
  rating: z.number().min(0).max(5).multipleOf(0.5).nullable().optional(),
  review: z.string().max(2000).nullable().optional(),
});

export type UpsertBookEntryRequest = z.infer<typeof UpsertBookEntryRequestSchema>;

// Corpo de PUT /api/books/favorites/:slot — o slot vai na URL, aqui só o
// livro escolhido.
export const SetBookFavoriteSlotRequestSchema = z.object({
  googleBooksId: z.string(),
});

export type SetBookFavoriteSlotRequest = z.infer<typeof SetBookFavoriteSlotRequestSchema>;

export const BookFavoriteSlotSchema = z.object({
  slot: FavoriteSlotNumberSchema,
  entry: BookEntryWithBookSchema.nullable(),
});

export type BookFavoriteSlot = z.infer<typeof BookFavoriteSlotSchema>;

export const BookFavoritesResponseSchema = z.object({
  slots: z.array(BookFavoriteSlotSchema).length(4),
});

export type BookFavoritesResponse = z.infer<typeof BookFavoritesResponseSchema>;

// "favorite" ordena/filtra por favoriteSlot (null = não favoritado). Sem
// "platform" (nunca existiu fora de jogos).
export const BOOK_ENTRY_SORT_FIELDS = ["status", "rating", "favorite", "updatedAt"] as const;

export const ListBookEntriesQuerySchema = z.object({
  status: BookStatusSchema.optional(),
  favorite: z.coerce.boolean().optional(),
  sortBy: z.enum(BOOK_ENTRY_SORT_FIELDS).default("updatedAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(24),
});

export type ListBookEntriesQuery = z.infer<typeof ListBookEntriesQuerySchema>;

export const PaginatedBookEntriesResponseSchema = z.object({
  items: z.array(BookEntryWithBookSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});

export type PaginatedBookEntriesResponse = z.infer<typeof PaginatedBookEntriesResponseSchema>;

export const BookListSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  itemCount: z.number().int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type BookList = z.infer<typeof BookListSchema>;

export const BookListsResponseSchema = z.object({
  lists: z.array(BookListSchema),
});

export type BookListsResponse = z.infer<typeof BookListsResponseSchema>;

export const BookListDetailSchema = BookListSchema.extend({
  items: z.array(BookSummarySchema),
});

export type BookListDetail = z.infer<typeof BookListDetailSchema>;

export const CreateBookListRequestSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(300).nullable().optional(),
});

export type CreateBookListRequest = z.infer<typeof CreateBookListRequestSchema>;

export const UpdateBookListRequestSchema = CreateBookListRequestSchema.partial();

export type UpdateBookListRequest = z.infer<typeof UpdateBookListRequestSchema>;

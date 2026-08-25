import { z } from "zod";
import { ActivityItemSchema } from "./activity";

// Modelo ONE-WAY (seguir, sem pedido/aceite — ver follow.schema.ts no
// backend) — o mesmo shape de "usuário resumido" serve tanto pra listar
// quem eu sigo quanto pro autor de cada item do feed de amigos.
export const FollowedUserSchema = z.object({
  username: z.string(),
  displayUsername: z.string(),
  image: z.url().nullable(),
});

export type FollowedUser = z.infer<typeof FollowedUserSchema>;

export const FollowingResponseSchema = z.object({
  items: z.array(FollowedUserSchema),
});

export type FollowingResponse = z.infer<typeof FollowingResponseSchema>;

export const FollowStatusResponseSchema = z.object({
  following: z.boolean(),
});

export type FollowStatusResponse = z.infer<typeof FollowStatusResponseSchema>;

// Mesmo item do feed de atividade "de sempre" (ver ActivityItemSchema em
// activity.ts), só que com o autor junto — o feed de amigos mistura
// atividade de várias pessoas, diferente do feed pessoal.
export const FriendActivityItemSchema = ActivityItemSchema.extend({
  author: FollowedUserSchema,
});

export type FriendActivityItem = z.infer<typeof FriendActivityItemSchema>;

export const FriendActivityFeedResponseSchema = z.object({
  items: z.array(FriendActivityItemSchema),
  nextCursor: z.iso.datetime().nullable(),
});

export type FriendActivityFeedResponse = z.infer<typeof FriendActivityFeedResponseSchema>;

// Aba "Procurar" da Social — diretório de outros usuários do app (nunca
// inclui o próprio viewer, resolvido no backend). `q` vazio devolve todo
// mundo, paginado — mesmo shape {items,page,pageSize,total} já usado nas
// listagens de entries por seção (ver ListGameEntriesQuerySchema e afins).
export const SearchUsersQuerySchema = z.object({
  q: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export type SearchUsersQuery = z.infer<typeof SearchUsersQuerySchema>;

export const PaginatedUsersResponseSchema = z.object({
  items: z.array(FollowedUserSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});

export type PaginatedUsersResponse = z.infer<typeof PaginatedUsersResponseSchema>;

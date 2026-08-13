import { z } from "zod";
import { MediaTypeSchema } from "./media-type";

// Feed de atividade da home — genérico entre seções (ver tabela `activity`
// no backend), não mais amarrado a jogos. Cada linha já guarda um snapshot
// dos dados de exibição (itemTitle/itemHref/itemCoverUrl) no momento do
// evento, então o feed nunca precisa saber como cada seção resolve seus
// próprios itens. `type` é vocabulário livre por seção (ex.: para jogos,
// "status_changed" | "favorited" | "rated" | "reviewed" | "added_to_list"),
// validado na escrita, não mais numa união discriminada no Zod.
export const ActivityItemSchema = z.object({
  id: z.string(),
  mediaType: MediaTypeSchema,
  itemId: z.string(),
  itemTitle: z.string(),
  itemHref: z.string(),
  itemCoverUrl: z.url().nullable(),
  type: z.string(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.iso.datetime(),
});

export type ActivityItem = z.infer<typeof ActivityItemSchema>;

// Paginação por cursor (createdAt do último item da página anterior) — um
// log append-only sofreria drift com paginação por offset. `mediaType`
// filtra o feed por seção (aba "Atividades" da home).
export const ListActivityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  before: z.iso.datetime().optional(),
  mediaType: MediaTypeSchema.optional(),
});

export type ListActivityQuery = z.infer<typeof ListActivityQuerySchema>;

export const ActivityFeedResponseSchema = z.object({
  items: z.array(ActivityItemSchema),
  nextCursor: z.iso.datetime().nullable(),
});

export type ActivityFeedResponse = z.infer<typeof ActivityFeedResponseSchema>;

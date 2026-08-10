import { MEDIA_TYPES } from "@cqntrack/shared";
import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth.schema";

// Log de atividade compartilhado entre TODAS as seções de mídia (jogos,
// séries, filmes, livros) — não é mais uma tabela por seção. Guarda um
// snapshot dos dados de exibição (itemTitle/itemHref/itemCoverUrl) no
// momento do evento, em vez de FK + join: assim o feed da home nunca
// precisa saber buscar dados em N tabelas diferentes, só ler esta aqui.
// `type` é vocabulário livre por seção (não é mais enum de coluna) —
// validado no service de escrita de cada seção.
export const activity = sqliteTable(
  "activity",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    mediaType: text("media_type", { enum: MEDIA_TYPES }).notNull(),
    itemId: text("item_id").notNull(),
    itemTitle: text("item_title").notNull(),
    itemHref: text("item_href").notNull(),
    itemCoverUrl: text("item_cover_url"),
    type: text("type").notNull(),
    metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [index("activity_user_created_idx").on(table.userId, table.createdAt)],
);

export const activityRelations = relations(activity, ({ one }) => ({
  user: one(user, { fields: [activity.userId], references: [user.id] }),
}));

import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { user } from "./auth.schema";

// Modelo ONE-WAY (Trakt/Letterboxd) — sem pedido/aceite. A linha em si já é
// o "segue"; não existe tabela de solicitação nem coluna de status. Sem
// `relations()` de propósito: a tabela tem 2 FKs pra `user` (follower e
// followee), o que exigiria `relationName` pra desambiguar — padrão que o
// projeto nunca usou em nenhum outro lugar. Quem precisa do usuário
// seguido junto (listFollowing/listFriendActivity, ver social.service.ts)
// faz join explícito em vez de usar a API relacional do Drizzle aqui.
export const follow = sqliteTable(
  "follow",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    followerId: text("follower_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    followeeId: text("followee_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    // Cobre os 2 únicos acessos deste escopo: "A já segue B?" (match exato
    // nas 2 colunas) e "todos que eu sigo" (prefixo followerId do índice
    // composto). Sem índice por followeeId sozinho — "quem me segue" é
    // fora de escopo.
    uniqueIndex("follow_follower_followee_unique").on(table.followerId, table.followeeId),
  ],
);

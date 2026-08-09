import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Linha única (singleton, id=1) — cache do access_token OAuth da IGDB/Twitch.
// Sem KV configurado no projeto ainda; ver src/integrations/igdb/token.ts.
export const igdbToken = sqliteTable("igdb_token", {
  id: integer("id").primaryKey().default(1),
  accessToken: text("access_token").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => new Date())
    .notNull(),
});

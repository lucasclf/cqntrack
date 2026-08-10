import {
  GameDetailResponseSchema,
  GameEntrySchema,
  ListGameEntriesQuerySchema,
  PaginatedGameEntriesResponseSchema,
  SearchGamesQuerySchema,
  SearchGamesResponseSchema,
  SetFavoriteRequestSchema,
  UpsertGameEntryRequestSchema,
} from "@cqntrack/shared";
import { Hono } from "hono";
import { type AuthedEnv, requireSession } from "../auth/require-session";
import { createDb } from "../db/client";
import {
  deleteGameEntry,
  getGameEntryForUser,
  listGameEntries,
  setGameFavorite,
  TooManyFavoritesError,
  upsertGameEntry,
} from "./entries.service";
import { GameNotFoundError, getOrCacheGame, mapCachedGameToSummary, searchGamesForUser } from "./games.service";

export const gamesRouter = new Hono<AuthedEnv>();

gamesRouter.use("*", requireSession);

function parseIgdbId(c: { req: { param: (name: string) => string } }): number | null {
  const igdbId = Number(c.req.param("igdbId"));
  return Number.isInteger(igdbId) ? igdbId : null;
}

// Rotas estáticas (/search, /entries) precisam vir ANTES de /:igdbId — senão o
// parâmetro dinâmico captura o segmento literal.
gamesRouter.get("/search", async (c) => {
  const parsed = SearchGamesQuerySchema.safeParse({
    q: c.req.query("q"),
    limit: c.req.query("limit"),
  });
  if (!parsed.success) {
    return c.json({ error: "invalid_query" }, 400);
  }

  const db = createDb(c.env);
  const results = await searchGamesForUser(c.env, db, parsed.data.q, parsed.data.limit);

  const body = SearchGamesResponseSchema.parse({ results });
  return c.json(body);
});

gamesRouter.get("/entries", async (c) => {
  const parsed = ListGameEntriesQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ error: "invalid_query" }, 400);
  }

  const db = createDb(c.env);
  const { items, total } = await listGameEntries(db, c.get("userId"), parsed.data);

  const body = PaginatedGameEntriesResponseSchema.parse({
    items,
    page: parsed.data.page,
    pageSize: parsed.data.pageSize,
    total,
  });
  return c.json(body);
});

gamesRouter.get("/:igdbId", async (c) => {
  const igdbId = parseIgdbId(c);
  if (igdbId === null) {
    return c.json({ error: "invalid_id" }, 400);
  }

  const db = createDb(c.env);
  try {
    const cachedGame = await getOrCacheGame(c.env, db, igdbId);
    const entry = await getGameEntryForUser(db, c.get("userId"), igdbId);

    const body = GameDetailResponseSchema.parse({
      game: { ...mapCachedGameToSummary(cachedGame), summary: cachedGame.summary },
      entry,
    });
    return c.json(body);
  } catch (error) {
    if (error instanceof GameNotFoundError) {
      return c.json({ error: "game_not_found" }, 404);
    }
    throw error;
  }
});

gamesRouter.put("/:igdbId/entry", async (c) => {
  const igdbId = parseIgdbId(c);
  if (igdbId === null) {
    return c.json({ error: "invalid_id" }, 400);
  }

  const json = await c.req.json().catch(() => null);
  const parsed = UpsertGameEntryRequestSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "invalid_body" }, 400);
  }

  const db = createDb(c.env);
  try {
    const entry = await upsertGameEntry(c.env, db, c.get("userId"), igdbId, parsed.data);
    return c.json(GameEntrySchema.parse(entry));
  } catch (error) {
    if (error instanceof GameNotFoundError) {
      return c.json({ error: "game_not_found" }, 404);
    }
    if (error instanceof TooManyFavoritesError) {
      return c.json({ error: "too_many_favorites" }, 409);
    }
    throw error;
  }
});

gamesRouter.delete("/:igdbId/entry", async (c) => {
  const igdbId = parseIgdbId(c);
  if (igdbId === null) {
    return c.json({ error: "invalid_id" }, 400);
  }

  const db = createDb(c.env);
  await deleteGameEntry(db, c.get("userId"), igdbId);
  return c.body(null, 204);
});

gamesRouter.patch("/:igdbId/favorite", async (c) => {
  const igdbId = parseIgdbId(c);
  if (igdbId === null) {
    return c.json({ error: "invalid_id" }, 400);
  }

  const json = await c.req.json().catch(() => null);
  const parsed = SetFavoriteRequestSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "invalid_body" }, 400);
  }

  const db = createDb(c.env);
  try {
    const entry = await setGameFavorite(c.env, db, c.get("userId"), igdbId, parsed.data.favorite);
    return c.json(GameEntrySchema.parse(entry));
  } catch (error) {
    if (error instanceof GameNotFoundError) {
      return c.json({ error: "game_not_found" }, 404);
    }
    if (error instanceof TooManyFavoritesError) {
      return c.json({ error: "too_many_favorites" }, 409);
    }
    throw error;
  }
});

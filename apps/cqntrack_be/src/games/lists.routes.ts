import {
  CreateGameListRequestSchema,
  GameListDetailSchema,
  GameListSchema,
  GameListsResponseSchema,
  UpdateGameListRequestSchema,
} from "@cqntrack/shared";
import { Hono } from "hono";
import { type AuthedEnv, requireSession } from "../auth/require-session";
import { createDb } from "../db/client";
import { GameNotFoundError } from "./games.service";
import {
  addGameToList,
  createGameList,
  deleteGameList,
  DuplicateGameListNameError,
  GameListNotFoundError,
  getGameListDetail,
  listGameLists,
  removeGameFromList,
  updateGameList,
} from "./lists.service";

export const listsRouter = new Hono<AuthedEnv>();

listsRouter.use("*", requireSession);

function parseIgdbId(c: { req: { param: (name: string) => string } }): number | null {
  const igdbId = Number(c.req.param("igdbId"));
  return Number.isInteger(igdbId) ? igdbId : null;
}

listsRouter.get("/", async (c) => {
  const db = createDb(c.env);
  const lists = await listGameLists(db, c.get("userId"));
  return c.json(GameListsResponseSchema.parse({ lists }));
});

listsRouter.post("/", async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = CreateGameListRequestSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "invalid_body" }, 400);
  }

  const db = createDb(c.env);
  try {
    const list = await createGameList(db, c.get("userId"), parsed.data);
    return c.json(GameListSchema.parse(list), 201);
  } catch (error) {
    if (error instanceof DuplicateGameListNameError) {
      return c.json({ error: "duplicate_name" }, 409);
    }
    throw error;
  }
});

listsRouter.get("/:listId", async (c) => {
  const db = createDb(c.env);
  try {
    const detail = await getGameListDetail(db, c.get("userId"), c.req.param("listId"));
    return c.json(GameListDetailSchema.parse(detail));
  } catch (error) {
    if (error instanceof GameListNotFoundError) {
      return c.json({ error: "list_not_found" }, 404);
    }
    throw error;
  }
});

listsRouter.patch("/:listId", async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = UpdateGameListRequestSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "invalid_body" }, 400);
  }

  const db = createDb(c.env);
  try {
    const list = await updateGameList(db, c.get("userId"), c.req.param("listId"), parsed.data);
    return c.json(GameListSchema.parse(list));
  } catch (error) {
    if (error instanceof GameListNotFoundError) {
      return c.json({ error: "list_not_found" }, 404);
    }
    if (error instanceof DuplicateGameListNameError) {
      return c.json({ error: "duplicate_name" }, 409);
    }
    throw error;
  }
});

listsRouter.delete("/:listId", async (c) => {
  const db = createDb(c.env);
  try {
    await deleteGameList(db, c.get("userId"), c.req.param("listId"));
    return c.body(null, 204);
  } catch (error) {
    if (error instanceof GameListNotFoundError) {
      return c.json({ error: "list_not_found" }, 404);
    }
    throw error;
  }
});

listsRouter.put("/:listId/items/:igdbId", async (c) => {
  const igdbId = parseIgdbId(c);
  if (igdbId === null) {
    return c.json({ error: "invalid_id" }, 400);
  }

  const db = createDb(c.env);
  try {
    await addGameToList(c.env, db, c.get("userId"), c.req.param("listId"), igdbId);
    return c.body(null, 204);
  } catch (error) {
    if (error instanceof GameListNotFoundError) {
      return c.json({ error: "list_not_found" }, 404);
    }
    if (error instanceof GameNotFoundError) {
      return c.json({ error: "game_not_found" }, 404);
    }
    throw error;
  }
});

listsRouter.delete("/:listId/items/:igdbId", async (c) => {
  const igdbId = parseIgdbId(c);
  if (igdbId === null) {
    return c.json({ error: "invalid_id" }, 400);
  }

  const db = createDb(c.env);
  try {
    await removeGameFromList(db, c.get("userId"), c.req.param("listId"), igdbId);
    return c.body(null, 204);
  } catch (error) {
    if (error instanceof GameListNotFoundError) {
      return c.json({ error: "list_not_found" }, 404);
    }
    throw error;
  }
});

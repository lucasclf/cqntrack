import {
  FavoritesResponseSchema,
  GameListDetailSchema,
  GameListsResponseSchema,
  ListGameEntriesQuerySchema,
  PaginatedGameEntriesResponseSchema,
  PublicProfileSchema,
} from "@cqntrack/shared";
import { Hono } from "hono";
import { createDb } from "../db/client";
import { getFavoriteSlots, listGameEntries } from "../games/entries.service";
import { GameListNotFoundError, getGameListDetail, listGameLists } from "../games/lists.service";
import { getPublicProfile, resolveUserIdByUsername, UserNotFoundError } from "./users.service";

// Rotas públicas do perfil (/u/:username) — sem requireSession de propósito:
// nenhum dado aqui é privado (decisão de produto já fechada).
export const usersRouter = new Hono<{ Bindings: Env }>();

usersRouter.get("/:username", async (c) => {
  const db = createDb(c.env);
  try {
    const profile = await getPublicProfile(db, c.req.param("username"));
    return c.json(PublicProfileSchema.parse(profile));
  } catch (error) {
    if (error instanceof UserNotFoundError) {
      return c.json({ error: "user_not_found" }, 404);
    }
    throw error;
  }
});

usersRouter.get("/:username/entries", async (c) => {
  const parsed = ListGameEntriesQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ error: "invalid_query" }, 400);
  }

  const db = createDb(c.env);
  try {
    const userId = await resolveUserIdByUsername(db, c.req.param("username"));
    const { items, total } = await listGameEntries(db, userId, parsed.data);
    return c.json(
      PaginatedGameEntriesResponseSchema.parse({
        items,
        page: parsed.data.page,
        pageSize: parsed.data.pageSize,
        total,
      }),
    );
  } catch (error) {
    if (error instanceof UserNotFoundError) {
      return c.json({ error: "user_not_found" }, 404);
    }
    throw error;
  }
});

usersRouter.get("/:username/favorites", async (c) => {
  const db = createDb(c.env);
  try {
    const userId = await resolveUserIdByUsername(db, c.req.param("username"));
    const slots = await getFavoriteSlots(db, userId);
    return c.json(FavoritesResponseSchema.parse({ slots }));
  } catch (error) {
    if (error instanceof UserNotFoundError) {
      return c.json({ error: "user_not_found" }, 404);
    }
    throw error;
  }
});

usersRouter.get("/:username/lists", async (c) => {
  const db = createDb(c.env);
  try {
    const userId = await resolveUserIdByUsername(db, c.req.param("username"));
    const lists = await listGameLists(db, userId);
    return c.json(GameListsResponseSchema.parse({ lists }));
  } catch (error) {
    if (error instanceof UserNotFoundError) {
      return c.json({ error: "user_not_found" }, 404);
    }
    throw error;
  }
});

usersRouter.get("/:username/lists/:listId", async (c) => {
  const db = createDb(c.env);
  try {
    const userId = await resolveUserIdByUsername(db, c.req.param("username"));
    const detail = await getGameListDetail(db, userId, c.req.param("listId"));
    return c.json(GameListDetailSchema.parse(detail));
  } catch (error) {
    if (error instanceof UserNotFoundError) {
      return c.json({ error: "user_not_found" }, 404);
    }
    if (error instanceof GameListNotFoundError) {
      return c.json({ error: "list_not_found" }, 404);
    }
    throw error;
  }
});

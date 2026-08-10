import {
  FavoritesResponseSchema,
  GameListDetailSchema,
  GameListsResponseSchema,
  ListGameEntriesQuerySchema,
  ListSeriesEntriesQuerySchema,
  PaginatedGameEntriesResponseSchema,
  PaginatedSeriesEntriesResponseSchema,
  PublicProfileSchema,
  SeriesFavoritesResponseSchema,
  SeriesListDetailSchema,
  SeriesListsResponseSchema,
} from "@cqntrack/shared";
import { Hono } from "hono";
import { createDb } from "../db/client";
import { getFavoriteSlots as getGameFavoriteSlots, listGameEntries } from "../games/entries.service";
import { GameListNotFoundError, getGameListDetail, listGameLists } from "../games/lists.service";
import { getFavoriteSlots as getSeriesFavoriteSlots, listSeriesEntries } from "../series/entries.service";
import { getSeriesListDetail, listSeriesLists, SeriesListNotFoundError } from "../series/lists.service";
import { getPublicProfile, resolveUserIdByUsername, UserNotFoundError } from "./users.service";

// Rotas públicas do perfil (/u/:username) — sem requireSession de propósito:
// nenhum dado aqui é privado (decisão de produto já fechada). Entries/
// favorites/lists ficam prefixadas por seção (/games/*, /series/*) desde que
// a segunda seção passou a existir de verdade.
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

usersRouter.get("/:username/games/entries", async (c) => {
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

usersRouter.get("/:username/games/favorites", async (c) => {
  const db = createDb(c.env);
  try {
    const userId = await resolveUserIdByUsername(db, c.req.param("username"));
    const slots = await getGameFavoriteSlots(db, userId);
    return c.json(FavoritesResponseSchema.parse({ slots }));
  } catch (error) {
    if (error instanceof UserNotFoundError) {
      return c.json({ error: "user_not_found" }, 404);
    }
    throw error;
  }
});

usersRouter.get("/:username/games/lists", async (c) => {
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

usersRouter.get("/:username/games/lists/:listId", async (c) => {
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

usersRouter.get("/:username/series/entries", async (c) => {
  const parsed = ListSeriesEntriesQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ error: "invalid_query" }, 400);
  }

  const db = createDb(c.env);
  try {
    const userId = await resolveUserIdByUsername(db, c.req.param("username"));
    const { items, total } = await listSeriesEntries(db, userId, parsed.data);
    return c.json(
      PaginatedSeriesEntriesResponseSchema.parse({
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

usersRouter.get("/:username/series/favorites", async (c) => {
  const db = createDb(c.env);
  try {
    const userId = await resolveUserIdByUsername(db, c.req.param("username"));
    const slots = await getSeriesFavoriteSlots(db, userId);
    return c.json(SeriesFavoritesResponseSchema.parse({ slots }));
  } catch (error) {
    if (error instanceof UserNotFoundError) {
      return c.json({ error: "user_not_found" }, 404);
    }
    throw error;
  }
});

usersRouter.get("/:username/series/lists", async (c) => {
  const db = createDb(c.env);
  try {
    const userId = await resolveUserIdByUsername(db, c.req.param("username"));
    const lists = await listSeriesLists(db, userId);
    return c.json(SeriesListsResponseSchema.parse({ lists }));
  } catch (error) {
    if (error instanceof UserNotFoundError) {
      return c.json({ error: "user_not_found" }, 404);
    }
    throw error;
  }
});

usersRouter.get("/:username/series/lists/:listId", async (c) => {
  const db = createDb(c.env);
  try {
    const userId = await resolveUserIdByUsername(db, c.req.param("username"));
    const detail = await getSeriesListDetail(db, userId, c.req.param("listId"));
    return c.json(SeriesListDetailSchema.parse(detail));
  } catch (error) {
    if (error instanceof UserNotFoundError) {
      return c.json({ error: "user_not_found" }, 404);
    }
    if (error instanceof SeriesListNotFoundError) {
      return c.json({ error: "list_not_found" }, 404);
    }
    throw error;
  }
});

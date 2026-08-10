import {
  CreateSeriesListRequestSchema,
  SeriesListDetailSchema,
  SeriesListSchema,
  SeriesListsResponseSchema,
  UpdateSeriesListRequestSchema,
} from "@cqntrack/shared";
import { Hono } from "hono";
import { type AuthedEnv, requireSession } from "../auth/require-session";
import { createDb } from "../db/client";
import {
  addSeriesToList,
  createSeriesList,
  deleteSeriesList,
  DuplicateSeriesListNameError,
  getSeriesListDetail,
  listSeriesLists,
  removeSeriesFromList,
  SeriesListNotFoundError,
  updateSeriesList,
} from "./lists.service";
import { SeriesNotFoundError } from "./series.service";

export const seriesListsRouter = new Hono<AuthedEnv>();

seriesListsRouter.use("*", requireSession);

function parseTmdbId(c: { req: { param: (name: string) => string } }): number | null {
  const tmdbId = Number(c.req.param("tmdbId"));
  return Number.isInteger(tmdbId) ? tmdbId : null;
}

seriesListsRouter.get("/", async (c) => {
  const db = createDb(c.env);
  const lists = await listSeriesLists(db, c.get("userId"));
  return c.json(SeriesListsResponseSchema.parse({ lists }));
});

seriesListsRouter.post("/", async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = CreateSeriesListRequestSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "invalid_body" }, 400);
  }

  const db = createDb(c.env);
  try {
    const list = await createSeriesList(db, c.get("userId"), parsed.data);
    return c.json(SeriesListSchema.parse(list), 201);
  } catch (error) {
    if (error instanceof DuplicateSeriesListNameError) {
      return c.json({ error: "duplicate_name" }, 409);
    }
    throw error;
  }
});

seriesListsRouter.get("/:listId", async (c) => {
  const db = createDb(c.env);
  try {
    const detail = await getSeriesListDetail(db, c.get("userId"), c.req.param("listId"));
    return c.json(SeriesListDetailSchema.parse(detail));
  } catch (error) {
    if (error instanceof SeriesListNotFoundError) {
      return c.json({ error: "list_not_found" }, 404);
    }
    throw error;
  }
});

seriesListsRouter.patch("/:listId", async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = UpdateSeriesListRequestSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "invalid_body" }, 400);
  }

  const db = createDb(c.env);
  try {
    const list = await updateSeriesList(db, c.get("userId"), c.req.param("listId"), parsed.data);
    return c.json(SeriesListSchema.parse(list));
  } catch (error) {
    if (error instanceof SeriesListNotFoundError) {
      return c.json({ error: "list_not_found" }, 404);
    }
    if (error instanceof DuplicateSeriesListNameError) {
      return c.json({ error: "duplicate_name" }, 409);
    }
    throw error;
  }
});

seriesListsRouter.delete("/:listId", async (c) => {
  const db = createDb(c.env);
  try {
    await deleteSeriesList(db, c.get("userId"), c.req.param("listId"));
    return c.body(null, 204);
  } catch (error) {
    if (error instanceof SeriesListNotFoundError) {
      return c.json({ error: "list_not_found" }, 404);
    }
    throw error;
  }
});

seriesListsRouter.put("/:listId/items/:tmdbId", async (c) => {
  const tmdbId = parseTmdbId(c);
  if (tmdbId === null) {
    return c.json({ error: "invalid_id" }, 400);
  }

  const db = createDb(c.env);
  try {
    await addSeriesToList(c.env, db, c.get("userId"), c.req.param("listId"), tmdbId);
    return c.body(null, 204);
  } catch (error) {
    if (error instanceof SeriesListNotFoundError) {
      return c.json({ error: "list_not_found" }, 404);
    }
    if (error instanceof SeriesNotFoundError) {
      return c.json({ error: "series_not_found" }, 404);
    }
    throw error;
  }
});

seriesListsRouter.delete("/:listId/items/:tmdbId", async (c) => {
  const tmdbId = parseTmdbId(c);
  if (tmdbId === null) {
    return c.json({ error: "invalid_id" }, 400);
  }

  const db = createDb(c.env);
  try {
    await removeSeriesFromList(db, c.get("userId"), c.req.param("listId"), tmdbId);
    return c.body(null, 204);
  } catch (error) {
    if (error instanceof SeriesListNotFoundError) {
      return c.json({ error: "list_not_found" }, 404);
    }
    throw error;
  }
});

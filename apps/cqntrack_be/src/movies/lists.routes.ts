import {
  CreateMovieListRequestSchema,
  MovieListDetailSchema,
  MovieListSchema,
  MovieListsResponseSchema,
  UpdateMovieListRequestSchema,
} from "@cqntrack/shared";
import { Hono } from "hono";
import { type AuthedEnv, requireSession } from "../auth/require-session";
import { createDb } from "../db/client";
import {
  addMovieToList,
  createMovieList,
  deleteMovieList,
  DuplicateMovieListNameError,
  getMovieListDetail,
  listMovieLists,
  MovieListNotFoundError,
  removeMovieFromList,
  updateMovieList,
} from "./lists.service";
import { MovieNotFoundError } from "./movies.service";

export const movieListsRouter = new Hono<AuthedEnv>();

movieListsRouter.use("*", requireSession);

function parseTmdbId(c: { req: { param: (name: string) => string } }): number | null {
  const tmdbId = Number(c.req.param("tmdbId"));
  return Number.isInteger(tmdbId) ? tmdbId : null;
}

movieListsRouter.get("/", async (c) => {
  const db = createDb(c.env);
  const lists = await listMovieLists(db, c.get("userId"));
  return c.json(MovieListsResponseSchema.parse({ lists }));
});

movieListsRouter.post("/", async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = CreateMovieListRequestSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "invalid_body" }, 400);
  }

  const db = createDb(c.env);
  try {
    const list = await createMovieList(db, c.get("userId"), parsed.data);
    return c.json(MovieListSchema.parse(list), 201);
  } catch (error) {
    if (error instanceof DuplicateMovieListNameError) {
      return c.json({ error: "duplicate_name" }, 409);
    }
    throw error;
  }
});

movieListsRouter.get("/:listId", async (c) => {
  const db = createDb(c.env);
  try {
    const detail = await getMovieListDetail(db, c.get("userId"), c.req.param("listId"));
    return c.json(MovieListDetailSchema.parse(detail));
  } catch (error) {
    if (error instanceof MovieListNotFoundError) {
      return c.json({ error: "list_not_found" }, 404);
    }
    throw error;
  }
});

movieListsRouter.patch("/:listId", async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = UpdateMovieListRequestSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "invalid_body" }, 400);
  }

  const db = createDb(c.env);
  try {
    const list = await updateMovieList(db, c.get("userId"), c.req.param("listId"), parsed.data);
    return c.json(MovieListSchema.parse(list));
  } catch (error) {
    if (error instanceof MovieListNotFoundError) {
      return c.json({ error: "list_not_found" }, 404);
    }
    if (error instanceof DuplicateMovieListNameError) {
      return c.json({ error: "duplicate_name" }, 409);
    }
    throw error;
  }
});

movieListsRouter.delete("/:listId", async (c) => {
  const db = createDb(c.env);
  try {
    await deleteMovieList(db, c.get("userId"), c.req.param("listId"));
    return c.body(null, 204);
  } catch (error) {
    if (error instanceof MovieListNotFoundError) {
      return c.json({ error: "list_not_found" }, 404);
    }
    throw error;
  }
});

movieListsRouter.put("/:listId/items/:tmdbId", async (c) => {
  const tmdbId = parseTmdbId(c);
  if (tmdbId === null) {
    return c.json({ error: "invalid_id" }, 400);
  }

  const db = createDb(c.env);
  try {
    await addMovieToList(c.env, db, c.get("userId"), c.req.param("listId"), tmdbId);
    return c.body(null, 204);
  } catch (error) {
    if (error instanceof MovieListNotFoundError) {
      return c.json({ error: "list_not_found" }, 404);
    }
    if (error instanceof MovieNotFoundError) {
      return c.json({ error: "movie_not_found" }, 404);
    }
    throw error;
  }
});

movieListsRouter.delete("/:listId/items/:tmdbId", async (c) => {
  const tmdbId = parseTmdbId(c);
  if (tmdbId === null) {
    return c.json({ error: "invalid_id" }, 400);
  }

  const db = createDb(c.env);
  try {
    await removeMovieFromList(db, c.get("userId"), c.req.param("listId"), tmdbId);
    return c.body(null, 204);
  } catch (error) {
    if (error instanceof MovieListNotFoundError) {
      return c.json({ error: "list_not_found" }, 404);
    }
    throw error;
  }
});

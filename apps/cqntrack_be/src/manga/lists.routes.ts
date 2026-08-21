import {
  CreateMangaListRequestSchema,
  MangaListDetailSchema,
  MangaListSchema,
  MangaListsResponseSchema,
  UpdateMangaListRequestSchema,
} from "@cqntrack/shared";
import { Hono } from "hono";
import { type AuthedEnv, requireSession } from "../auth/require-session";
import { createDb } from "../db/client";
import { MangaNotFoundError } from "./manga.service";
import {
  addMangaToList,
  createMangaList,
  deleteMangaList,
  DuplicateMangaListNameError,
  getMangaListDetail,
  listMangaLists,
  MangaListNotFoundError,
  removeMangaFromList,
  updateMangaList,
} from "./lists.service";

export const mangaListsRouter = new Hono<AuthedEnv>();

mangaListsRouter.use("*", requireSession);

mangaListsRouter.get("/", async (c) => {
  const db = createDb(c.env);
  const lists = await listMangaLists(db, c.get("userId"));
  return c.json(MangaListsResponseSchema.parse({ lists }));
});

mangaListsRouter.post("/", async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = CreateMangaListRequestSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "invalid_body" }, 400);
  }

  const db = createDb(c.env);
  try {
    const list = await createMangaList(db, c.get("userId"), parsed.data);
    return c.json(MangaListSchema.parse(list), 201);
  } catch (error) {
    if (error instanceof DuplicateMangaListNameError) {
      return c.json({ error: "duplicate_name" }, 409);
    }
    throw error;
  }
});

mangaListsRouter.get("/:listId", async (c) => {
  const db = createDb(c.env);
  try {
    const detail = await getMangaListDetail(db, c.get("userId"), c.req.param("listId"));
    return c.json(MangaListDetailSchema.parse(detail));
  } catch (error) {
    if (error instanceof MangaListNotFoundError) {
      return c.json({ error: "list_not_found" }, 404);
    }
    throw error;
  }
});

mangaListsRouter.patch("/:listId", async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = UpdateMangaListRequestSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "invalid_body" }, 400);
  }

  const db = createDb(c.env);
  try {
    const list = await updateMangaList(db, c.get("userId"), c.req.param("listId"), parsed.data);
    return c.json(MangaListSchema.parse(list));
  } catch (error) {
    if (error instanceof MangaListNotFoundError) {
      return c.json({ error: "list_not_found" }, 404);
    }
    if (error instanceof DuplicateMangaListNameError) {
      return c.json({ error: "duplicate_name" }, 409);
    }
    throw error;
  }
});

mangaListsRouter.delete("/:listId", async (c) => {
  const db = createDb(c.env);
  try {
    await deleteMangaList(db, c.get("userId"), c.req.param("listId"));
    return c.body(null, 204);
  } catch (error) {
    if (error instanceof MangaListNotFoundError) {
      return c.json({ error: "list_not_found" }, 404);
    }
    throw error;
  }
});

mangaListsRouter.put("/:listId/items/:mangadexId", async (c) => {
  const db = createDb(c.env);
  try {
    await addMangaToList(db, c.get("userId"), c.req.param("listId"), c.req.param("mangadexId"));
    return c.body(null, 204);
  } catch (error) {
    if (error instanceof MangaListNotFoundError) {
      return c.json({ error: "list_not_found" }, 404);
    }
    if (error instanceof MangaNotFoundError) {
      return c.json({ error: "manga_not_found" }, 404);
    }
    throw error;
  }
});

mangaListsRouter.delete("/:listId/items/:mangadexId", async (c) => {
  const db = createDb(c.env);
  try {
    await removeMangaFromList(
      db,
      c.get("userId"),
      c.req.param("listId"),
      c.req.param("mangadexId"),
    );
    return c.body(null, 204);
  } catch (error) {
    if (error instanceof MangaListNotFoundError) {
      return c.json({ error: "list_not_found" }, 404);
    }
    throw error;
  }
});

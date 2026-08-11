import {
  BookListDetailSchema,
  BookListSchema,
  BookListsResponseSchema,
  CreateBookListRequestSchema,
  UpdateBookListRequestSchema,
} from "@cqntrack/shared";
import { Hono } from "hono";
import { type AuthedEnv, requireSession } from "../auth/require-session";
import { createDb } from "../db/client";
import { BookNotFoundError } from "./books.service";
import {
  addBookToList,
  BookListNotFoundError,
  createBookList,
  deleteBookList,
  DuplicateBookListNameError,
  getBookListDetail,
  listBookLists,
  removeBookFromList,
  updateBookList,
} from "./lists.service";

export const bookListsRouter = new Hono<AuthedEnv>();

bookListsRouter.use("*", requireSession);

bookListsRouter.get("/", async (c) => {
  const db = createDb(c.env);
  const lists = await listBookLists(db, c.get("userId"));
  return c.json(BookListsResponseSchema.parse({ lists }));
});

bookListsRouter.post("/", async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = CreateBookListRequestSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "invalid_body" }, 400);
  }

  const db = createDb(c.env);
  try {
    const list = await createBookList(db, c.get("userId"), parsed.data);
    return c.json(BookListSchema.parse(list), 201);
  } catch (error) {
    if (error instanceof DuplicateBookListNameError) {
      return c.json({ error: "duplicate_name" }, 409);
    }
    throw error;
  }
});

bookListsRouter.get("/:listId", async (c) => {
  const db = createDb(c.env);
  try {
    const detail = await getBookListDetail(db, c.get("userId"), c.req.param("listId"));
    return c.json(BookListDetailSchema.parse(detail));
  } catch (error) {
    if (error instanceof BookListNotFoundError) {
      return c.json({ error: "list_not_found" }, 404);
    }
    throw error;
  }
});

bookListsRouter.patch("/:listId", async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = UpdateBookListRequestSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "invalid_body" }, 400);
  }

  const db = createDb(c.env);
  try {
    const list = await updateBookList(db, c.get("userId"), c.req.param("listId"), parsed.data);
    return c.json(BookListSchema.parse(list));
  } catch (error) {
    if (error instanceof BookListNotFoundError) {
      return c.json({ error: "list_not_found" }, 404);
    }
    if (error instanceof DuplicateBookListNameError) {
      return c.json({ error: "duplicate_name" }, 409);
    }
    throw error;
  }
});

bookListsRouter.delete("/:listId", async (c) => {
  const db = createDb(c.env);
  try {
    await deleteBookList(db, c.get("userId"), c.req.param("listId"));
    return c.body(null, 204);
  } catch (error) {
    if (error instanceof BookListNotFoundError) {
      return c.json({ error: "list_not_found" }, 404);
    }
    throw error;
  }
});

bookListsRouter.put("/:listId/items/:googleBooksId", async (c) => {
  const db = createDb(c.env);
  try {
    await addBookToList(c.env, db, c.get("userId"), c.req.param("listId"), c.req.param("googleBooksId"));
    return c.body(null, 204);
  } catch (error) {
    if (error instanceof BookListNotFoundError) {
      return c.json({ error: "list_not_found" }, 404);
    }
    if (error instanceof BookNotFoundError) {
      return c.json({ error: "book_not_found" }, 404);
    }
    throw error;
  }
});

bookListsRouter.delete("/:listId/items/:googleBooksId", async (c) => {
  const db = createDb(c.env);
  try {
    await removeBookFromList(db, c.get("userId"), c.req.param("listId"), c.req.param("googleBooksId"));
    return c.body(null, 204);
  } catch (error) {
    if (error instanceof BookListNotFoundError) {
      return c.json({ error: "list_not_found" }, 404);
    }
    throw error;
  }
});

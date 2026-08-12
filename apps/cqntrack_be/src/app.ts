import { AuthUserSchema, HealthResponseSchema } from "@cqntrack/shared";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { activityRouter } from "./activity/activity.routes";
import { createAuth } from "./auth/auth";
import { requireSession } from "./auth/require-session";
import { booksRouter } from "./books/books.routes";
import { bookListsRouter } from "./books/lists.routes";
import { gamesRouter } from "./games/games.routes";
import { listsRouter } from "./games/lists.routes";
import { movieListsRouter } from "./movies/lists.routes";
import { moviesRouter } from "./movies/movies.routes";
import { peopleRouter } from "./people/people.routes";
import { seriesListsRouter } from "./series/lists.routes";
import { seriesRouter } from "./series/series.routes";
import { usersRouter } from "./users/users.routes";

export const app = new Hono<{ Bindings: Env }>();

app.use(
  "/api/*",
  cors({
    origin: (_origin, c) => c.env.FRONTEND_ORIGIN,
    credentials: true,
  }),
);

app.on(["POST", "GET"], "/api/auth/*", (c) => createAuth(c.env).handler(c.req.raw));

app.get("/api/health", (c) => {
  const body = HealthResponseSchema.parse({ status: "ok" });
  return c.json(body);
});

// Primeira rota protegida do projeto — valida o middleware de sessão ponta a ponta.
app.get("/api/me", requireSession, (c) => {
  const body = AuthUserSchema.parse({
    id: c.get("userId"),
    email: c.get("userEmail"),
    name: c.get("userName"),
    username: c.get("username"),
    displayUsername: c.get("displayUsername"),
  });
  return c.json(body);
});

app.route("/api/books", booksRouter);
app.route("/api/books-lists", bookListsRouter);
app.route("/api/games", gamesRouter);
app.route("/api/lists", listsRouter);
app.route("/api/series", seriesRouter);
app.route("/api/series-lists", seriesListsRouter);
app.route("/api/movies", moviesRouter);
app.route("/api/movies-lists", movieListsRouter);
app.route("/api/people", peopleRouter);
app.route("/api/activity", activityRouter);
app.route("/api/users", usersRouter);

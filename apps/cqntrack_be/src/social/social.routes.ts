import {
  FollowingResponseSchema,
  FollowStatusResponseSchema,
  FriendActivityFeedResponseSchema,
  ListActivityQuerySchema,
} from "@cqntrack/shared";
import { Hono } from "hono";
import { type AuthedEnv, requireSession } from "../auth/require-session";
import { createDb } from "../db/client";
import { UserNotFoundError } from "../users/users.service";
import {
  followUser,
  getFollowStatus,
  listFollowing,
  listFriendActivity,
  SelfFollowError,
  unfollowUser,
} from "./social.service";

export const socialRouter = new Hono<AuthedEnv>();

socialRouter.use("*", requireSession);

// Idempotente (204 mesmo se já seguia) — ver followUser em social.service.ts.
socialRouter.put("/follow/:username", async (c) => {
  try {
    await followUser(createDb(c.env), c.get("userId"), c.req.param("username"));
    return c.body(null, 204);
  } catch (error) {
    if (error instanceof UserNotFoundError) {
      return c.json({ error: "user_not_found" }, 404);
    }
    if (error instanceof SelfFollowError) {
      return c.json({ error: "cannot_follow_self" }, 400);
    }
    throw error;
  }
});

// Idempotente (204 mesmo se já não seguia) — ver unfollowUser em social.service.ts.
socialRouter.delete("/follow/:username", async (c) => {
  try {
    await unfollowUser(createDb(c.env), c.get("userId"), c.req.param("username"));
    return c.body(null, 204);
  } catch (error) {
    if (error instanceof UserNotFoundError) {
      return c.json({ error: "user_not_found" }, 404);
    }
    throw error;
  }
});

socialRouter.get("/follow/:username/status", async (c) => {
  try {
    const status = await getFollowStatus(createDb(c.env), c.get("userId"), c.req.param("username"));
    return c.json(FollowStatusResponseSchema.parse(status));
  } catch (error) {
    if (error instanceof UserNotFoundError) {
      return c.json({ error: "user_not_found" }, 404);
    }
    throw error;
  }
});

socialRouter.get("/following", async (c) => {
  const items = await listFollowing(createDb(c.env), c.get("userId"));
  return c.json(FollowingResponseSchema.parse({ items }));
});

// "Continuar assistindo" de amigos, por assim dizer — feed de atividade de
// quem eu sigo, mesmo formato/paginação de GET /api/activity (ver
// activity.routes.ts), só que multi-autor (ver listFriendActivity).
socialRouter.get("/feed", async (c) => {
  const parsed = ListActivityQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ error: "invalid_query" }, 400);
  }

  const db = createDb(c.env);
  const { items, nextCursor } = await listFriendActivity(db, c.get("userId"), parsed.data);

  return c.json(FriendActivityFeedResponseSchema.parse({ items, nextCursor }));
});

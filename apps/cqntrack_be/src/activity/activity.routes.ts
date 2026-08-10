import { ActivityFeedResponseSchema, ListActivityQuerySchema } from "@cqntrack/shared";
import { Hono } from "hono";
import { type AuthedEnv, requireSession } from "../auth/require-session";
import { createDb } from "../db/client";
import { listActivity } from "./activity.service";

export const activityRouter = new Hono<AuthedEnv>();

activityRouter.use("*", requireSession);

activityRouter.get("/", async (c) => {
  const parsed = ListActivityQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ error: "invalid_query" }, 400);
  }

  const db = createDb(c.env);
  const { items, nextCursor } = await listActivity(db, c.get("userId"), parsed.data);

  return c.json(ActivityFeedResponseSchema.parse({ items, nextCursor }));
});

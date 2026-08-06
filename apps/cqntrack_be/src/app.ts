import { HealthResponseSchema } from "@cqntrack/shared";
import { Hono } from "hono";
import { cors } from "hono/cors";

export const app = new Hono();

// Sem credentials/cookies ainda (better-auth vem depois), então liberar qualquer origin é seguro por ora.
app.use("/api/*", cors());

app.get("/api/health", (c) => {
  const body = HealthResponseSchema.parse({ status: "ok" });
  return c.json(body);
});

import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { app } from "./app";

describe("GET /api/health", () => {
  it("retorna status ok", async () => {
    const res = await app.request("/api/health", undefined, env);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: "ok" });
  });
});

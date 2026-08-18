import { env } from "cloudflare:workers";
import { describe, expect, it, vi } from "vitest";
import { createAuthenticatedUser } from "../test/auth-helpers";
import { app } from "./app";

describe("GET /api/health", () => {
  it("retorna status ok", async () => {
    const res = await app.request("/api/health", undefined, env);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: "ok" });
  });
});

describe("PUT /api/me/avatar", () => {
  function avatarFile(sizeBytes: number, type = "image/png") {
    return new File([new Uint8Array(sizeBytes)], "avatar.png", { type });
  }

  function formWith(file: File) {
    const form = new FormData();
    form.set("file", file);
    return form;
  }

  async function expectedSignature(formData: FormData): Promise<string> {
    const input =
      `overwrite=${formData.get("overwrite")}&public_id=${formData.get("public_id")}` +
      `&timestamp=${formData.get("timestamp")}&transformation=${formData.get("transformation")}` +
      env.CLOUDINARY_API_SECRET;
    const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(input));
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  it("sem sessão retorna 401", async () => {
    const res = await app.request(
      "/api/me/avatar",
      { method: "PUT", body: formWith(avatarFile(100)) },
      env,
    );

    expect(res.status).toBe(401);
  });

  it("tipo de arquivo não permitido retorna 400, sem chamar o Cloudinary", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    const throwingFetch = vi.fn().mockRejectedValue(new Error("não deveria chamar o Cloudinary"));
    vi.stubGlobal("fetch", throwingFetch);

    const res = await app.request(
      "/api/me/avatar",
      { method: "PUT", headers: { cookie }, body: formWith(avatarFile(100, "text/plain")) },
      env,
    );
    vi.unstubAllGlobals();

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "invalid_file" });
  });

  it("arquivo maior que o limite retorna 400, sem chamar o Cloudinary", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    const throwingFetch = vi.fn().mockRejectedValue(new Error("não deveria chamar o Cloudinary"));
    vi.stubGlobal("fetch", throwingFetch);

    const res = await app.request(
      "/api/me/avatar",
      {
        method: "PUT",
        headers: { cookie },
        body: formWith(avatarFile(6 * 1024 * 1024)),
      },
      env,
    );
    vi.unstubAllGlobals();

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "file_too_large" });
  });

  it("sobe a imagem com assinatura válida e public_id determinístico por usuário", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);

    let capturedForm: FormData | null = null;
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      capturedForm = init.body as FormData;
      return new Response(
        JSON.stringify({
          secure_url: "https://res.cloudinary.com/demo/image/upload/v1/avatars/x.png",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await app.request(
      "/api/me/avatar",
      { method: "PUT", headers: { cookie }, body: formWith(avatarFile(100)) },
      env,
    );
    vi.unstubAllGlobals();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      url: "https://res.cloudinary.com/demo/image/upload/v1/avatars/x.png",
    });

    expect(capturedForm).not.toBeNull();
    const form = capturedForm!;
    expect(form.get("public_id")).toMatch(/^avatars\//);
    expect(form.get("overwrite")).toBe("true");
    expect(form.get("signature")).toBe(await expectedSignature(form));
  });

  it("erro do Cloudinary vira 502", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("upstream error", { status: 500 })),
    );

    const res = await app.request(
      "/api/me/avatar",
      { method: "PUT", headers: { cookie }, body: formWith(avatarFile(100)) },
      env,
    );
    vi.unstubAllGlobals();

    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toEqual({ error: "avatar_upload_failed" });
  });
});

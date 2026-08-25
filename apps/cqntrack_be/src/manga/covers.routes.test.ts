import { env } from "cloudflare:workers";
import { describe, expect, it, vi } from "vitest";
import { app } from "../app";

// A MangaDex serve uma imagem errada de propósito pra hotlink direto do
// navegador (api.mangadex.org/docs/2-limitations/) — por isso este proxy
// precisa existir, e por isso ele NUNCA pode exigir sessão (o app Android
// nativo carrega imagem por URL direta, sem cookie — ver covers.routes.ts).
describe("GET /api/manga/covers/:mangaId/:fileName", () => {
  it("sem sessão retorna a imagem normalmente (rota pública de propósito)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "Content-Type": "image/jpeg" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await app.request("/api/manga/covers/manga-1/capa.jpg.512.jpg", undefined, env);
    vi.unstubAllGlobals();

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
    expect(res.headers.get("Cache-Control")).toContain("max-age=604800");
  });

  it("busca no domínio real da MangaDex, com User-Agent, sem header Via", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "Content-Type": "image/jpeg" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await app.request("/api/manga/covers/manga-1/capa.jpg.512.jpg", undefined, env);
    vi.unstubAllGlobals();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://uploads.mangadex.org/covers/manga-1/capa.jpg.512.jpg");
    const headers = new Headers(init.headers);
    expect(headers.get("User-Agent")).toBeTruthy();
    expect(headers.has("Via")).toBe(false);
  });

  it("capa inexistente (404 na MangaDex) repassa 404", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));

    const res = await app.request(
      "/api/manga/covers/manga-inexistente/capa.jpg.512.jpg",
      undefined,
      env,
    );
    vi.unstubAllGlobals();

    expect(res.status).toBe(404);
  });

  it("erro upstream (5xx) vira 502, não vaza o status original", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));

    const res = await app.request("/api/manga/covers/manga-1/capa.jpg.512.jpg", undefined, env);
    vi.unstubAllGlobals();

    expect(res.status).toBe(502);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { GamesApiError, gamesClient } from "./games-client";

describe("gamesClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("faz GET com credentials include e devolve o corpo parseado", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ lists: [] }),
      }),
    );

    const result = await gamesClient.get<{ lists: unknown[] }>("/api/lists");

    expect(result).toEqual({ lists: [] });
    expect(fetch).toHaveBeenCalledWith(
      "/api/lists",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("serializa o body em POST/PUT/PATCH", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 201, json: () => Promise.resolve({ id: "1" }) }),
    );

    await gamesClient.post("/api/lists", { name: "Quero jogar" });

    expect(fetch).toHaveBeenCalledWith(
      "/api/lists",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ name: "Quero jogar" }) }),
    );
  });

  it("devolve undefined em respostas 204", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 204 }));

    const result = await gamesClient.delete("/api/lists/1");

    expect(result).toBeUndefined();
  });

  it("lança GamesApiError em respostas não-2xx", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));

    await expect(gamesClient.get("/api/lists/inexistente")).rejects.toBeInstanceOf(GamesApiError);
  });
});

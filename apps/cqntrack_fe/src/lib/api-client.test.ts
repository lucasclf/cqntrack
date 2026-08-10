import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiClient } from "./api-client";

describe("apiClient", () => {
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

    const result = await apiClient.get<{ lists: unknown[] }>("/api/lists");

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

    await apiClient.post("/api/lists", { name: "Quero jogar" });

    expect(fetch).toHaveBeenCalledWith(
      "/api/lists",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ name: "Quero jogar" }) }),
    );
  });

  it("devolve undefined em respostas 204", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 204 }));

    const result = await apiClient.delete("/api/lists/1");

    expect(result).toBeUndefined();
  });

  it("lança ApiError em respostas não-2xx", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));

    await expect(apiClient.get("/api/lists/inexistente")).rejects.toBeInstanceOf(ApiError);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

const { getAuthTokenMock } = vi.hoisted(() => ({ getAuthTokenMock: vi.fn() }));

vi.mock("./mobile-token-storage", () => ({ getAuthToken: getAuthTokenMock }));

describe("apiClient (mobile)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    getAuthTokenMock.mockReset();
  });

  it("manda Authorization: Bearer com o token guardado, sem credentials", async () => {
    getAuthTokenMock.mockResolvedValue("token-abc");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ ok: true }) }),
    );
    const { apiClient } = await import("./api-client.mobile");

    await apiClient.get("/api/games/entries");

    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    const headers = init!.headers as Headers;
    expect(headers.get("authorization")).toBe("Bearer token-abc");
    expect(init).not.toHaveProperty("credentials");
  });

  it("sem token guardado, não manda header Authorization", async () => {
    getAuthTokenMock.mockResolvedValue(undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({}) }),
    );
    const { apiClient } = await import("./api-client.mobile");

    await apiClient.get("/api/games/entries");

    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    const headers = init!.headers as Headers;
    expect(headers.has("authorization")).toBe(false);
  });

  it("putForm manda o FormData cru com Authorization, sem forçar Content-Type", async () => {
    getAuthTokenMock.mockResolvedValue("token-abc");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ url: "x" }) }),
    );
    const { apiClient } = await import("./api-client.mobile");
    const formData = new FormData();
    formData.set("file", new File(["a"], "avatar.png", { type: "image/png" }));

    await apiClient.putForm("/api/me/avatar", formData);

    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(init!.body).toBe(formData);
    const headers = init!.headers as Headers;
    expect(headers.get("authorization")).toBe("Bearer token-abc");
    expect(headers.has("content-type")).toBe(false);
  });
});

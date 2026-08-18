import { describe, expect, it, vi } from "vitest";

const { getMock, setMock, removeMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  setMock: vi.fn(),
  removeMock: vi.fn(),
}));

vi.mock("@capacitor/preferences", () => ({
  Preferences: { get: getMock, set: setMock, remove: removeMock },
}));

describe("mobile-token-storage", () => {
  it("getAuthToken devolve o valor guardado", async () => {
    const { getAuthToken } = await import("./mobile-token-storage");
    getMock.mockResolvedValue({ value: "token-123" });

    await expect(getAuthToken()).resolves.toBe("token-123");
    expect(getMock).toHaveBeenCalledWith({ key: "cqntrack_auth_token" });
  });

  it("getAuthToken devolve undefined quando não há nada guardado", async () => {
    const { getAuthToken } = await import("./mobile-token-storage");
    getMock.mockResolvedValue({ value: null });

    await expect(getAuthToken()).resolves.toBeUndefined();
  });

  it("setAuthToken guarda o valor recebido", async () => {
    const { setAuthToken } = await import("./mobile-token-storage");

    await setAuthToken("novo-token");

    expect(setMock).toHaveBeenCalledWith({ key: "cqntrack_auth_token", value: "novo-token" });
  });

  it("clearAuthToken remove o valor guardado", async () => {
    const { clearAuthToken } = await import("./mobile-token-storage");

    await clearAuthToken();

    expect(removeMock).toHaveBeenCalledWith({ key: "cqntrack_auth_token" });
  });
});

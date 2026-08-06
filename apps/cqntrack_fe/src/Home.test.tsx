import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Home } from "./Home";

describe("Home", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ status: "ok" }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exibe o status retornado pelo backend", async () => {
    render(<Home />);

    expect(await screen.findByText("Status do backend: ok")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/health");
  });
});

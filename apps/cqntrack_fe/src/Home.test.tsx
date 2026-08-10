import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Home } from "./Home";

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock("./lib/games-client", () => ({
  gamesClient: { get: getMock },
}));

describe("Home", () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it("mostra o título e a atividade recente do usuário", async () => {
    getMock.mockResolvedValue({ items: [], nextCursor: null });
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "cqntrack" })).toBeInTheDocument();
    expect(await screen.findByText(/Nenhuma atividade ainda/)).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledWith("/api/activity");
  });
});

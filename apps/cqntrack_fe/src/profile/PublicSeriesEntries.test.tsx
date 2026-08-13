import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PublicSeriesEntries } from "./PublicSeriesEntries";

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock("../lib/api-client", () => ({
  apiClient: { get: getMock },
}));

const SERIES = {
  tmdbId: 1396,
  name: "Breaking Bad",
  posterUrl: null,
  firstAirDate: "2008-01-20",
  genres: [],
  numberOfSeasons: 5,
  numberOfEpisodes: 62,
  seasons: null,
  rating: null,
};

function renderPage(initialEntry: string) {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/:handle/series" element={<PublicSeriesEntries />} />
      </Routes>
    </MemoryRouter>,
  );
}

function lastQuery(): URLSearchParams {
  const call = getMock.mock.calls.at(-1) as [string];
  return new URLSearchParams(call[0].split("?")[1]);
}

describe("PublicSeriesEntries", () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it("mostra 'Séries acompanhadas' e as séries retornadas", async () => {
    getMock.mockResolvedValue({
      items: [{ series: SERIES, lastWatchedAt: "2026-01-02T00:00:00.000Z" }],
      page: 1,
      pageSize: 24,
      total: 1,
    });
    renderPage("/@lucas/series");

    expect(await screen.findByRole("heading", { name: "Séries acompanhadas" })).toBeInTheDocument();
    expect(screen.getByText("Breaking Bad")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Voltar pro perfil/ })).toHaveAttribute("href", "/@lucas");
  });

  it("pagina com os botões Anterior/Próxima", async () => {
    getMock.mockResolvedValue({
      items: [{ series: SERIES, lastWatchedAt: "2026-01-02T00:00:00.000Z" }],
      page: 1,
      pageSize: 24,
      total: 50,
    });
    renderPage("/@lucas/series");

    await screen.findByText("Breaking Bad");
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));

    expect(lastQuery().get("page")).toBe("2");
  });

  it("mostra hint quando não há séries", async () => {
    getMock.mockResolvedValue({ items: [], page: 1, pageSize: 24, total: 0 });
    renderPage("/@lucas/series");

    expect(await screen.findByText("Nada por aqui ainda.")).toBeInTheDocument();
  });

  it("handle inválido (sem @) mostra 'usuário não encontrado', sem chamar a API", async () => {
    renderPage("/lucas/series");

    expect(await screen.findByText("Usuário não encontrado.")).toBeInTheDocument();
    expect(getMock).not.toHaveBeenCalled();
  });
});

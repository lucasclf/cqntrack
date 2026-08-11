import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MyMovieEntries } from "./MyMovieEntries";

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock("../lib/api-client", () => ({
  apiClient: { get: getMock },
}));

const ENTRY = {
  id: "1",
  rating: 4,
  watchedAt: "2026-01-01T00:00:00.000Z",
  favoriteSlot: null,
  review: null,
  updatedAt: "2026-01-01T00:00:00.000Z",
  movie: {
    tmdbId: 27205,
    name: "Inception",
    posterUrl: null,
    releaseDate: "2010-07-15",
    genres: [],
    runtime: 148,
    rating: null,
  },
};

function renderPage() {
  render(
    <MemoryRouter>
      <MyMovieEntries />
    </MemoryRouter>,
  );
}

function lastQuery(): URLSearchParams {
  const call = getMock.mock.calls.at(-1) as [string];
  return new URLSearchParams(call[0].split("?")[1]);
}

describe("MyMovieEntries", () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it("carrega a primeira página com os filtros padrão", async () => {
    getMock.mockResolvedValue({ items: [ENTRY], page: 1, pageSize: 24, total: 1 });
    renderPage();

    expect(await screen.findByText("Inception")).toBeInTheDocument();
    const query = lastQuery();
    expect(query.get("sortBy")).toBe("updatedAt");
    expect(query.get("order")).toBe("desc");
    expect(query.get("page")).toBe("1");
    expect(query.get("watched")).toBeNull();
  });

  it("mostra mensagem quando não há filmes com os filtros atuais", async () => {
    getMock.mockResolvedValue({ items: [], page: 1, pageSize: 24, total: 0 });
    renderPage();

    expect(
      await screen.findByText("Nenhum filme encontrado com esses filtros."),
    ).toBeInTheDocument();
  });

  it("mostra erro quando a busca falha", async () => {
    getMock.mockRejectedValue(new Error("falha de rede"));
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Falha ao carregar seus filmes");
  });

  it("refaz a busca com o filtro de favoritos ao marcar a checkbox", async () => {
    getMock.mockResolvedValue({ items: [ENTRY], page: 1, pageSize: 24, total: 1 });
    renderPage();
    await screen.findByText("Inception");

    fireEvent.click(screen.getByLabelText("Somente favoritos"));

    await screen.findByText("Inception");
    expect(lastQuery().get("favorite")).toBe("true");
  });

  it("refaz a busca com o filtro de assistido ao trocar o select", async () => {
    getMock.mockResolvedValue({ items: [ENTRY], page: 1, pageSize: 24, total: 1 });
    renderPage();
    await screen.findByText("Inception");

    fireEvent.change(screen.getByLabelText("Assistido"), { target: { value: "true" } });

    await screen.findByText("Inception");
    expect(lastQuery().get("watched")).toBe("true");
  });

  it("navega entre páginas e reseta pra página 1 ao mudar um filtro", async () => {
    getMock.mockResolvedValue({ items: [ENTRY], page: 1, pageSize: 24, total: 50 });
    renderPage();
    await screen.findByText("Inception");

    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    await act(async () => {});
    expect(lastQuery().get("page")).toBe("2");

    fireEvent.click(screen.getByLabelText("Somente favoritos"));
    await act(async () => {});
    expect(lastQuery().get("page")).toBe("1");
  });
});

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { BookFavoritesGrid } from "./BookFavoritesGrid";

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock("../lib/api-client", () => ({
  apiClient: { get: getMock },
}));

const BOOK_ENTRY = {
  id: "1",
  status: "read",
  rating: 4.5,
  favoritedAt: "2026-01-02T00:00:00.000Z",
  review: null,
  updatedAt: "2026-01-02T00:00:00.000Z",
  book: {
    googleBooksId: "PCq3AAAAQBAJ",
    title: "Dom Casmurro",
    authors: ["Machado de Assis"],
    coverUrl: null,
    publishedDate: "1899",
    categories: [],
    pageCount: null,
    rating: null,
  },
};

function renderGrid() {
  return render(
    <MemoryRouter>
      <BookFavoritesGrid />
    </MemoryRouter>,
  );
}

describe("BookFavoritesGrid", () => {
  it("mostra os livros favoritados", async () => {
    getMock.mockResolvedValue({ items: [BOOK_ENTRY] });
    renderGrid();

    expect(await screen.findByText("Dom Casmurro")).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledWith("/api/books/favorites");
  });

  it("mostra um aviso quando não há favoritos", async () => {
    getMock.mockResolvedValue({ items: [] });
    renderGrid();

    expect(await screen.findByText("Nenhum livro favoritado ainda.")).toBeInTheDocument();
  });

  it("mostra erro quando a busca falha", async () => {
    getMock.mockRejectedValue(new Error("falha de rede"));
    renderGrid();

    expect(await screen.findByRole("alert")).toHaveTextContent("Falha ao carregar seus favoritos");
  });
});

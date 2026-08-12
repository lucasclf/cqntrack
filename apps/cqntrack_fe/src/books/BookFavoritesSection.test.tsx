import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BookFavoritesSection } from "./BookFavoritesSection";

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock("../lib/api-client", () => ({
  apiClient: { get: getMock },
}));

const BOOK = {
  googleBooksId: "PCq3AAAAQBAJ",
  title: "Dom Casmurro",
  authors: [],
  coverUrl: null,
  publishedDate: "1899",
  categories: [],
  pageCount: null,
  rating: null,
};

const ENTRY = {
  id: "1",
  status: null,
  rating: null,
  favoritedAt: "2026-01-01T00:00:00.000Z",
  review: null,
  updatedAt: "2026-01-01T00:00:00.000Z",
  book: BOOK,
};

function renderSection(favoritesEndpoint = "/api/users/gamer_1/books/favorites") {
  return render(
    <MemoryRouter>
      <BookFavoritesSection favoritesEndpoint={favoritesEndpoint} />
    </MemoryRouter>,
  );
}

describe("BookFavoritesSection", () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it("busca no endpoint informado e mostra os favoritos", async () => {
    getMock.mockResolvedValue({ items: [ENTRY] });
    renderSection();

    expect(await screen.findByRole("heading", { name: "Livros favoritos" })).toBeInTheDocument();
    expect(screen.getByText("Dom Casmurro")).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledWith("/api/users/gamer_1/books/favorites");
  });

  it("não renderiza nada quando não há favoritos", async () => {
    getMock.mockResolvedValue({ items: [] });
    const { container } = renderSection();

    await waitFor(() => expect(getMock).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("não renderiza nada quando a busca falha", async () => {
    getMock.mockRejectedValue(new Error("falha de rede"));
    const { container } = renderSection();

    await waitFor(() => expect(getMock).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});

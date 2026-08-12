import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../lib/api-client";
import { BookDetail } from "./BookDetail";

const { getMock, putMock, deleteMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  putMock: vi.fn(),
  deleteMock: vi.fn(),
}));

vi.mock("../lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("../lib/api-client")>("../lib/api-client");
  return {
    ...actual,
    apiClient: { get: getMock, put: putMock, delete: deleteMock, post: vi.fn(), patch: vi.fn() },
  };
});

const BOOK = {
  googleBooksId: "PCq3AAAAQBAJ",
  title: "Dom Casmurro",
  authors: ["Machado de Assis"],
  coverUrl: null,
  publishedDate: "1899",
  categories: ["Fiction"],
  pageCount: 256,
  rating: 4.5,
  description: "A história de Bentinho e sua desconfiança em relação a Capitu.",
};

function renderDetail() {
  render(
    <MemoryRouter initialEntries={["/livros/PCq3AAAAQBAJ"]}>
      <Routes>
        <Route path="/livros/:googleBooksId" element={<BookDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("BookDetail", () => {
  it("mostra os dados do livro e a marcação existente, sem ação de favoritar", async () => {
    getMock.mockResolvedValue({
      book: BOOK,
      entry: {
        id: "1",
        status: "reading",
        rating: 4.5,
        favoriteSlot: 1,
        review: "Muito bom",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    renderDetail();

    expect(await screen.findByRole("heading", { name: "Dom Casmurro" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lendo" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByDisplayValue("Muito bom")).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledWith("/api/books/PCq3AAAAQBAJ");
    // Favoritar não acontece mais nesta página (só pelos slots da home).
    expect(screen.queryByRole("button", { name: /favorit/i })).not.toBeInTheDocument();
    // Autor linka pra própria página do autor (livros/autores/:name).
    expect(screen.getByRole("link", { name: "Machado de Assis" })).toHaveAttribute(
      "href",
      "/livros/autores/Machado%20de%20Assis",
    );
  });

  it("cria a marcação ao escolher um status quando ainda não existe entry", async () => {
    getMock.mockResolvedValue({ book: BOOK, entry: null });
    putMock.mockResolvedValue({
      id: "2",
      status: "reading",
      rating: null,
      favoriteSlot: null,
      review: null,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    renderDetail();

    await screen.findByRole("heading", { name: "Dom Casmurro" });
    fireEvent.click(screen.getByRole("button", { name: "Lendo" }));

    expect(putMock).toHaveBeenCalledWith("/api/books/PCq3AAAAQBAJ/entry", { status: "reading" });
    expect(await screen.findByRole("button", { name: "Lendo" })).toHaveAttribute("aria-pressed", "true");
  });

  it("remove a marcação existente", async () => {
    getMock.mockResolvedValue({
      book: BOOK,
      entry: {
        id: "1",
        status: "reading",
        rating: null,
        favoriteSlot: null,
        review: null,
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    deleteMock.mockResolvedValue(undefined);
    renderDetail();

    await screen.findByRole("heading", { name: "Dom Casmurro" });
    fireEvent.click(screen.getByRole("button", { name: "Remover marcação" }));

    expect(deleteMock).toHaveBeenCalledWith("/api/books/PCq3AAAAQBAJ/entry");
    expect(await screen.findByRole("button", { name: "Lendo" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("button", { name: "Remover marcação" })).not.toBeInTheDocument();
  });

  it("mostra 'livro não encontrado' quando a API retorna 404", async () => {
    getMock.mockRejectedValue(new ApiError(404, "not found"));
    renderDetail();

    expect(await screen.findByText("Livro não encontrado.")).toBeInTheDocument();
  });

  it("mostra mensagem de erro genérica em outras falhas", async () => {
    getMock.mockRejectedValue(new Error("falha de rede"));
    renderDetail();

    expect(await screen.findByRole("alert")).toHaveTextContent("Falha ao carregar o livro");
  });
});

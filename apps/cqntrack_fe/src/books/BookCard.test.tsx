import type { BookEntry, BookSummary } from "@cqntrack/shared";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BookCard } from "./BookCard";

const { putMock } = vi.hoisted(() => ({ putMock: vi.fn() }));

vi.mock("../lib/api-client", () => ({
  apiClient: { put: putMock },
}));

const BASE_BOOK: BookSummary = {
  googleBooksId: "PCq3AAAAQBAJ",
  title: "Dom Casmurro",
  authors: ["Machado de Assis", "Coautor de Teste"],
  coverUrl: "https://books.google.com/books/content?id=PCq3AAAAQBAJ",
  publishedDate: "1899",
  categories: ["Fiction"],
  pageCount: 256,
  rating: 4.5,
};

function renderCard(book: BookSummary, entry?: BookEntry | null, interactive = false) {
  return render(
    <MemoryRouter>
      <BookCard book={book} entry={entry} interactive={interactive} />
    </MemoryRouter>,
  );
}

describe("BookCard", () => {
  it("linka pro detalhe do livro e mostra título, ano, autor e nota", () => {
    renderCard(BASE_BOOK);

    expect(screen.getByRole("link")).toHaveAttribute("href", "/livros/PCq3AAAAQBAJ");
    expect(screen.getByText("Dom Casmurro")).toBeInTheDocument();
    expect(screen.getByText(/1899/)).toBeInTheDocument();
    expect(screen.getByText(/Machado de Assis/)).toBeInTheDocument();
    expect(screen.getByText(/\+1/)).toBeInTheDocument();
    expect(screen.getByText("4.5")).toBeInTheDocument();
  });

  it("lida com capa, nota, autores e data ausentes sem quebrar", () => {
    renderCard({
      ...BASE_BOOK,
      coverUrl: null,
      rating: null,
      authors: [],
      publishedDate: null,
    });

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("Data desconhecida")).toBeInTheDocument();
  });

  it("mostra status, nota pessoal e selo de favorito quando há entry", () => {
    renderCard(BASE_BOOK, {
      id: "1",
      status: "read",
      rating: 4.5,
      favoritedAt: "2026-01-01T00:00:00.000Z",
      review: null,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(screen.getByText("Lido")).toBeInTheDocument();
    expect(screen.getByText("★ 4.5")).toBeInTheDocument();
    expect(screen.getByLabelText("Favoritado")).toBeInTheDocument();
  });

  it("reserva a linha de status/nota mesmo quando a entry não tem nenhum dos dois", () => {
    // Favoritar não define status nem nota — sem isso, esse card fica mais
    // baixo que os vizinhos que têm status/nota, quebrando o grid (bug real).
    const { container } = renderCard(BASE_BOOK, {
      id: "1",
      status: null,
      rating: null,
      favoritedAt: "2026-01-01T00:00:00.000Z",
      review: null,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(container.querySelector("p:last-child")).toBeEmptyDOMElement();
  });

  it("sem interactive, não renderiza os botões de ação rápida", () => {
    renderCard(BASE_BOOK);

    expect(screen.queryByLabelText("Favoritar")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Marcar como lido")).not.toBeInTheDocument();
  });

  describe("interactive", () => {
    beforeEach(() => {
      putMock.mockReset();
    });

    it("favoritar chama o PUT e atualiza otimista", () => {
      putMock.mockResolvedValue({});
      renderCard(BASE_BOOK, null, true);

      fireEvent.click(screen.getByLabelText("Favoritar"));

      expect(putMock).toHaveBeenCalledWith("/api/books/PCq3AAAAQBAJ/entry", { favorited: true });
      expect(screen.getByLabelText("Desfavoritar")).toBeInTheDocument();
    });

    it("marcar como lido chama o PUT com status read", () => {
      putMock.mockResolvedValue({});
      renderCard(BASE_BOOK, null, true);

      fireEvent.click(screen.getByLabelText("Marcar como lido"));

      expect(putMock).toHaveBeenCalledWith("/api/books/PCq3AAAAQBAJ/entry", { status: "read" });
      expect(screen.getByLabelText("Desmarcar como lido")).toBeInTheDocument();
    });

    it("clicar de novo em lido desmarca (status: null)", () => {
      putMock.mockResolvedValue({});
      renderCard(
        BASE_BOOK,
        {
          id: "1",
          status: "read",
          rating: null,
          favoritedAt: null,
          review: null,
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
        true,
      );

      fireEvent.click(screen.getByLabelText("Desmarcar como lido"));

      expect(putMock).toHaveBeenCalledWith("/api/books/PCq3AAAAQBAJ/entry", { status: null });
    });

    it("reverte a marcação otimista quando o PUT falha", async () => {
      putMock.mockRejectedValue(new Error("falha de rede"));
      renderCard(BASE_BOOK, null, true);

      fireEvent.click(screen.getByLabelText("Favoritar"));
      expect(screen.getByLabelText("Desfavoritar")).toBeInTheDocument();

      await waitFor(() => expect(screen.getByLabelText("Favoritar")).toBeInTheDocument());
    });

    it("o clique no botão não navega pro detalhe (preventDefault)", () => {
      putMock.mockResolvedValue({});
      renderCard(BASE_BOOK, null, true);

      const clickEvent = new MouseEvent("click", { bubbles: true, cancelable: true });
      const preventDefaultSpy = vi.spyOn(clickEvent, "preventDefault");
      screen.getByLabelText("Favoritar").dispatchEvent(clickEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });
});

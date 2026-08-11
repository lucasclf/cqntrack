import type { BookEntry, BookSummary } from "@cqntrack/shared";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { BookCard } from "./BookCard";

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

function renderCard(book: BookSummary, entry?: BookEntry) {
  return render(
    <MemoryRouter>
      <BookCard book={book} entry={entry} />
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
      favoriteSlot: 2,
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
      favoriteSlot: 1,
      review: null,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(container.querySelector("p:last-child")).toBeEmptyDOMElement();
  });
});

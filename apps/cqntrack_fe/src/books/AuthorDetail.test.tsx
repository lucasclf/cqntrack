import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { AuthorDetail } from "./AuthorDetail";

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock("../lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("../lib/api-client")>("../lib/api-client");
  return {
    ...actual,
    apiClient: { get: getMock, put: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  };
});

function renderDetail() {
  render(
    <MemoryRouter initialEntries={["/livros/autores/Frank%20Herbert"]}>
      <Routes>
        <Route path="/livros/autores/:name" element={<AuthorDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AuthorDetail", () => {
  it("mostra o nome do autor e os livros dele, linkando pro detalhe de cada um", async () => {
    getMock.mockResolvedValue({
      name: "Frank Herbert",
      books: [
        {
          googleBooksId: "id-1",
          title: "Duna",
          authors: ["Frank Herbert"],
          coverUrl: null,
          publishedDate: "1965-08-01",
          categories: [],
          pageCount: null,
          rating: null,
        },
      ],
    });
    renderDetail();

    expect(await screen.findByRole("heading", { name: "Frank Herbert" })).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledWith("/api/books/authors/Frank%20Herbert");
    expect(screen.getByRole("link", { name: /Duna/ })).toHaveAttribute("href", "/livros/id-1");
  });

  it("mostra um aviso quando o autor não tem nenhum livro encontrado", async () => {
    getMock.mockResolvedValue({ name: "Autor Inexistente", books: [] });
    renderDetail();

    expect(
      await screen.findByText("Nenhum outro livro encontrado desse autor."),
    ).toBeInTheDocument();
  });

  it("mostra mensagem de erro genérica quando a busca falha", async () => {
    getMock.mockRejectedValue(new Error("falha de rede"));
    renderDetail();

    expect(await screen.findByRole("alert")).toHaveTextContent("Falha ao carregar o autor");
  });
});

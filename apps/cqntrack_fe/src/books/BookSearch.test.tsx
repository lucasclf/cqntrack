import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BookSearch } from "./BookSearch";

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock("../lib/api-client", () => ({
  apiClient: { get: getMock },
}));

function renderSearch() {
  render(
    <MemoryRouter>
      <BookSearch />
    </MemoryRouter>,
  );
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("BookSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    getMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("só busca 300ms depois de parar de digitar (debounce)", async () => {
    getMock.mockResolvedValue({ results: [] });
    renderSearch();

    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar livros" }), {
      target: { value: "dom casmurro" },
    });

    expect(getMock).not.toHaveBeenCalled();

    await advance(299);
    expect(getMock).not.toHaveBeenCalled();

    await advance(1);
    expect(getMock).toHaveBeenCalledWith("/api/books/search?q=dom%20casmurro");
  });

  it("mostra os resultados retornados pela busca", async () => {
    getMock.mockResolvedValue({
      results: [
        {
          googleBooksId: "PCq3AAAAQBAJ",
          title: "Dom Casmurro",
          authors: [],
          coverUrl: null,
          publishedDate: "1899",
          categories: [],
          pageCount: null,
          rating: null,
        },
      ],
    });
    renderSearch();

    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar livros" }), {
      target: { value: "dom casmurro" },
    });
    await advance(300);

    expect(screen.getByText("Dom Casmurro")).toBeInTheDocument();
  });

  it("mostra mensagem de erro quando a busca falha", async () => {
    getMock.mockRejectedValue(new Error("falha de rede"));
    renderSearch();

    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar livros" }), {
      target: { value: "dom casmurro" },
    });
    await advance(300);

    expect(screen.getByRole("alert")).toHaveTextContent("Falha ao buscar livros");
  });

  it("limpa os resultados quando o campo fica vazio", async () => {
    getMock.mockResolvedValue({
      results: [
        {
          googleBooksId: "PCq3AAAAQBAJ",
          title: "Dom Casmurro",
          authors: [],
          coverUrl: null,
          publishedDate: "1899",
          categories: [],
          pageCount: null,
          rating: null,
        },
      ],
    });
    renderSearch();
    const input = screen.getByRole("searchbox", { name: "Buscar livros" });

    fireEvent.change(input, { target: { value: "dom casmurro" } });
    await advance(300);
    expect(screen.getByText("Dom Casmurro")).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "" } });
    await advance(300);

    expect(screen.queryByText("Dom Casmurro")).not.toBeInTheDocument();
  });
});

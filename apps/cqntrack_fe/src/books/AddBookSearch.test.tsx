import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AddBookSearch } from "./AddBookSearch";

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

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("AddBookSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    getMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("busca com debounce e mostra o botão adicionar", async () => {
    getMock.mockResolvedValue({ results: [BOOK] });
    const onAdd = vi.fn();
    render(<AddBookSearch onAdd={onAdd} />);

    fireEvent.change(screen.getByLabelText("Buscar livro pra adicionar à lista"), {
      target: { value: "dom casmurro" },
    });
    await advance(300);

    expect(getMock).toHaveBeenCalledWith("/api/books/search?q=dom%20casmurro");
    expect(screen.getByText("Dom Casmurro")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    expect(onAdd).toHaveBeenCalledWith(BOOK);
  });

  it("zera o input e os resultados assim que adiciona o livro", async () => {
    getMock.mockResolvedValue({ results: [BOOK] });
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<AddBookSearch onAdd={onAdd} />);

    const input = screen.getByLabelText("Buscar livro pra adicionar à lista");
    fireEvent.change(input, { target: { value: "dom casmurro" } });
    await advance(300);
    expect(screen.getByText("Dom Casmurro")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    });

    expect(input).toHaveValue("");
    expect(screen.queryByText("Dom Casmurro")).not.toBeInTheDocument();
  });

  it("mostra 'Já na lista' e desabilita o botão pra livros em addedIds", async () => {
    getMock.mockResolvedValue({ results: [BOOK] });
    render(<AddBookSearch onAdd={vi.fn()} addedIds={new Set(["PCq3AAAAQBAJ"])} />);

    fireEvent.change(screen.getByLabelText("Buscar livro pra adicionar à lista"), {
      target: { value: "dom casmurro" },
    });
    await advance(300);

    expect(screen.getByRole("button", { name: "Já na lista" })).toBeDisabled();
  });
});

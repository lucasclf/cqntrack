import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BookFavoritePickerModal } from "./BookFavoritePickerModal";

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

describe("BookFavoritePickerModal", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    getMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("busca com debounce e chama onSelect ao clicar num resultado", async () => {
    getMock.mockResolvedValue({ results: [BOOK] });
    const onSelect = vi.fn();
    render(<BookFavoritePickerModal onSelect={onSelect} onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Buscar livro"), { target: { value: "dom casmurro" } });
    await advance(300);

    expect(getMock).toHaveBeenCalledWith("/api/books/search?q=dom%20casmurro");
    fireEvent.click(screen.getByRole("button", { name: "Dom Casmurro" }));

    expect(onSelect).toHaveBeenCalledWith(BOOK);
  });

  it("fecha ao clicar em cancelar ou no overlay", () => {
    const onClose = vi.fn();
    render(<BookFavoritePickerModal onSelect={vi.fn()} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("presentation"));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("clicar dentro do modal não fecha o popup", () => {
    const onClose = vi.fn();
    render(<BookFavoritePickerModal onSelect={vi.fn()} onClose={onClose} />);

    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();
  });
});

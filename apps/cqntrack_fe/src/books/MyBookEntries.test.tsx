import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MyBookEntries } from "./MyBookEntries";

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock("../lib/api-client", () => ({
  apiClient: { get: getMock },
}));

const ENTRY = {
  id: "1",
  status: "reading" as const,
  rating: 4,
  favoriteSlot: null,
  review: null,
  updatedAt: "2026-01-01T00:00:00.000Z",
  book: {
    googleBooksId: "PCq3AAAAQBAJ",
    title: "Dom Casmurro",
    authors: [],
    coverUrl: null,
    publishedDate: "1899",
    categories: [],
    pageCount: null,
    rating: null,
  },
};

function renderPage() {
  render(
    <MemoryRouter>
      <MyBookEntries />
    </MemoryRouter>,
  );
}

function lastQuery(): URLSearchParams {
  const call = getMock.mock.calls.at(-1) as [string];
  return new URLSearchParams(call[0].split("?")[1]);
}

describe("MyBookEntries", () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it("carrega a primeira página com os filtros padrão", async () => {
    getMock.mockResolvedValue({ items: [ENTRY], page: 1, pageSize: 24, total: 1 });
    renderPage();

    expect(await screen.findByText("Dom Casmurro")).toBeInTheDocument();
    const query = lastQuery();
    expect(query.get("sortBy")).toBe("updatedAt");
    expect(query.get("order")).toBe("desc");
    expect(query.get("page")).toBe("1");
  });

  it("mostra mensagem quando não há marcações com os filtros atuais", async () => {
    getMock.mockResolvedValue({ items: [], page: 1, pageSize: 24, total: 0 });
    renderPage();

    expect(await screen.findByText("Nenhuma marcação encontrada com esses filtros.")).toBeInTheDocument();
  });

  it("mostra erro quando a busca falha", async () => {
    getMock.mockRejectedValue(new Error("falha de rede"));
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Falha ao carregar suas marcações");
  });

  it("refaz a busca com o novo status ao trocar o filtro", async () => {
    getMock.mockResolvedValue({ items: [ENTRY], page: 1, pageSize: 24, total: 1 });
    renderPage();
    await screen.findByText("Dom Casmurro");

    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "reading" } });

    await screen.findByText("Dom Casmurro");
    expect(lastQuery().get("status")).toBe("reading");
  });

  it("navega entre páginas e reseta pra página 1 ao mudar um filtro", async () => {
    getMock.mockResolvedValue({ items: [ENTRY], page: 1, pageSize: 24, total: 50 });
    renderPage();
    await screen.findByText("Dom Casmurro");

    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    await act(async () => {});
    expect(lastQuery().get("page")).toBe("2");

    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "reading" } });
    await act(async () => {});
    expect(lastQuery().get("page")).toBe("1");
  });
});

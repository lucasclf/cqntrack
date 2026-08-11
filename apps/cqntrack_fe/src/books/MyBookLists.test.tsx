import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MyBookLists } from "./MyBookLists";

const { getMock, postMock, deleteMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  deleteMock: vi.fn(),
}));

vi.mock("../lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("../lib/api-client")>("../lib/api-client");
  return {
    ...actual,
    apiClient: { get: getMock, post: postMock, delete: deleteMock, put: vi.fn(), patch: vi.fn() },
  };
});

function renderPage() {
  render(
    <MemoryRouter>
      <MyBookLists />
    </MemoryRouter>,
  );
}

const LIST = {
  id: "1",
  name: "Lidos em 2026",
  description: "Já li tudo",
  itemCount: 3,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("MyBookLists", () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    deleteMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("mostra as listas do usuário", async () => {
    getMock.mockResolvedValue({ lists: [LIST] });
    renderPage();

    expect(await screen.findByText("Lidos em 2026")).toBeInTheDocument();
    expect(screen.getByText("3 livro(s)")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Lidos em 2026/ })).toHaveAttribute(
      "href",
      "/livros/listas/1",
    );
  });

  it("mostra mensagem quando não há listas", async () => {
    getMock.mockResolvedValue({ lists: [] });
    renderPage();

    expect(await screen.findByText("Você ainda não criou nenhuma lista.")).toBeInTheDocument();
  });

  it("cria uma lista pelo modal e ela aparece na listagem", async () => {
    getMock.mockResolvedValue({ lists: [] });
    postMock.mockResolvedValue({ ...LIST, id: "2", name: "Quero ler", itemCount: 0 });
    renderPage();

    await screen.findByText("Você ainda não criou nenhuma lista.");
    fireEvent.click(screen.getByRole("button", { name: "Nova lista" }));
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Quero ler" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Quero ler")).toBeInTheDocument();
    expect(postMock).toHaveBeenCalledWith("/api/books-lists", {
      name: "Quero ler",
      description: null,
    });
  });

  it("remove uma lista após confirmação", async () => {
    getMock.mockResolvedValue({ lists: [LIST] });
    deleteMock.mockResolvedValue(undefined);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderPage();

    await screen.findByText("Lidos em 2026");
    fireEvent.click(screen.getByRole("button", { name: "Remover" }));

    expect(deleteMock).toHaveBeenCalledWith("/api/books-lists/1");
    await waitFor(() => expect(screen.queryByText("Lidos em 2026")).not.toBeInTheDocument());
  });
});

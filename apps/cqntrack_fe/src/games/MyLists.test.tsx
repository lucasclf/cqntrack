import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MyLists } from "./MyLists";

const { getMock, postMock, deleteMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  deleteMock: vi.fn(),
}));

vi.mock("../lib/games-client", async () => {
  const actual = await vi.importActual<typeof import("../lib/games-client")>("../lib/games-client");
  return {
    ...actual,
    gamesClient: { get: getMock, post: postMock, delete: deleteMock, put: vi.fn(), patch: vi.fn() },
  };
});

function renderPage() {
  render(
    <MemoryRouter>
      <MyLists />
    </MemoryRouter>,
  );
}

const LIST = {
  id: "1",
  name: "Quero jogar",
  description: "Backlog",
  itemCount: 3,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("MyLists", () => {
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

    expect(await screen.findByText("Quero jogar")).toBeInTheDocument();
    expect(screen.getByText("3 jogo(s)")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Quero jogar/ })).toHaveAttribute("href", "/listas/1");
  });

  it("mostra mensagem quando não há listas", async () => {
    getMock.mockResolvedValue({ lists: [] });
    renderPage();

    expect(await screen.findByText("Você ainda não criou nenhuma lista.")).toBeInTheDocument();
  });

  it("cria uma lista pelo modal e ela aparece na listagem", async () => {
    getMock.mockResolvedValue({ lists: [] });
    postMock.mockResolvedValue({ ...LIST, id: "2", name: "Jogado em 2026", itemCount: 0 });
    renderPage();

    await screen.findByText("Você ainda não criou nenhuma lista.");
    fireEvent.click(screen.getByRole("button", { name: "Nova lista" }));
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Jogado em 2026" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Jogado em 2026")).toBeInTheDocument();
    expect(postMock).toHaveBeenCalledWith("/api/lists", { name: "Jogado em 2026", description: null });
  });

  it("remove uma lista após confirmação", async () => {
    getMock.mockResolvedValue({ lists: [LIST] });
    deleteMock.mockResolvedValue(undefined);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderPage();

    await screen.findByText("Quero jogar");
    fireEvent.click(screen.getByRole("button", { name: "Remover" }));

    expect(deleteMock).toHaveBeenCalledWith("/api/lists/1");
    await waitFor(() => expect(screen.queryByText("Quero jogar")).not.toBeInTheDocument());
  });
});

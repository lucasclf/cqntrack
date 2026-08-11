import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MyMovieLists } from "./MyMovieLists";

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
      <MyMovieLists />
    </MemoryRouter>,
  );
}

const LIST = {
  id: "1",
  name: "Vistos em 2026",
  description: "Já vi tudo",
  itemCount: 3,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("MyMovieLists", () => {
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

    expect(await screen.findByText("Vistos em 2026")).toBeInTheDocument();
    expect(screen.getByText("3 filme(s)")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Vistos em 2026/ })).toHaveAttribute(
      "href",
      "/filmes/listas/1",
    );
  });

  it("mostra mensagem quando não há listas", async () => {
    getMock.mockResolvedValue({ lists: [] });
    renderPage();

    expect(await screen.findByText("Você ainda não criou nenhuma lista.")).toBeInTheDocument();
  });

  it("cria uma lista pelo modal e ela aparece na listagem", async () => {
    getMock.mockResolvedValue({ lists: [] });
    postMock.mockResolvedValue({ ...LIST, id: "2", name: "Quero ver", itemCount: 0 });
    renderPage();

    await screen.findByText("Você ainda não criou nenhuma lista.");
    fireEvent.click(screen.getByRole("button", { name: "Nova lista" }));
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Quero ver" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Quero ver")).toBeInTheDocument();
    expect(postMock).toHaveBeenCalledWith("/api/movies-lists", {
      name: "Quero ver",
      description: null,
    });
  });

  it("remove uma lista após confirmação", async () => {
    getMock.mockResolvedValue({ lists: [LIST] });
    deleteMock.mockResolvedValue(undefined);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderPage();

    await screen.findByText("Vistos em 2026");
    fireEvent.click(screen.getByRole("button", { name: "Remover" }));

    expect(deleteMock).toHaveBeenCalledWith("/api/movies-lists/1");
    await waitFor(() => expect(screen.queryByText("Vistos em 2026")).not.toBeInTheDocument());
  });
});

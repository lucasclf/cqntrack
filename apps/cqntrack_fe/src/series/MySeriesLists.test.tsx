import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MySeriesLists } from "./MySeriesLists";

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
      <MySeriesLists />
    </MemoryRouter>,
  );
}

const LIST = {
  id: "1",
  name: "Maratonadas",
  description: "Já vi tudo",
  itemCount: 3,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("MySeriesLists", () => {
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

    expect(await screen.findByText("Maratonadas")).toBeInTheDocument();
    expect(screen.getByText("3 série(s)")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Maratonadas/ })).toHaveAttribute(
      "href",
      "/series/listas/1",
    );
  });

  it("mostra mensagem quando não há listas", async () => {
    getMock.mockResolvedValue({ lists: [] });
    renderPage();

    expect(await screen.findByText("Você ainda não criou nenhuma lista.")).toBeInTheDocument();
  });

  it("cria uma lista pelo modal e ela aparece na listagem", async () => {
    getMock.mockResolvedValue({ lists: [] });
    postMock.mockResolvedValue({ ...LIST, id: "2", name: "Quero assistir", itemCount: 0 });
    renderPage();

    await screen.findByText("Você ainda não criou nenhuma lista.");
    fireEvent.click(screen.getByRole("button", { name: "Nova lista" }));
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Quero assistir" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Quero assistir")).toBeInTheDocument();
    expect(postMock).toHaveBeenCalledWith("/api/series-lists", {
      name: "Quero assistir",
      description: null,
    });
  });

  it("remove uma lista após confirmação", async () => {
    getMock.mockResolvedValue({ lists: [LIST] });
    deleteMock.mockResolvedValue(undefined);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderPage();

    await screen.findByText("Maratonadas");
    fireEvent.click(screen.getByRole("button", { name: "Remover" }));

    expect(deleteMock).toHaveBeenCalledWith("/api/series-lists/1");
    await waitFor(() => expect(screen.queryByText("Maratonadas")).not.toBeInTheDocument());
  });
});

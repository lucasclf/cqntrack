import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AddToSeriesListMenu } from "./AddToSeriesListMenu";

const { getMock, putMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  putMock: vi.fn(),
  postMock: vi.fn(),
}));

vi.mock("../lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("../lib/api-client")>("../lib/api-client");
  return {
    ...actual,
    apiClient: { get: getMock, put: putMock, post: postMock, patch: vi.fn(), delete: vi.fn() },
  };
});

describe("AddToSeriesListMenu", () => {
  it("não busca as listas antes de abrir o menu", () => {
    render(<AddToSeriesListMenu tmdbId={1396} />);

    expect(getMock).not.toHaveBeenCalled();
  });

  it("busca e mostra as listas ao abrir, adiciona ao clicar e fecha o submenu", async () => {
    getMock.mockResolvedValue({
      lists: [
        {
          id: "1",
          name: "Maratonadas",
          description: null,
          itemCount: 0,
          createdAt: "",
          updatedAt: "",
        },
      ],
    });
    putMock.mockResolvedValue(undefined);
    render(<AddToSeriesListMenu tmdbId={1396} />);

    fireEvent.click(screen.getByRole("button", { name: "Adicionar a uma lista" }));

    expect(await screen.findByRole("button", { name: "Maratonadas" })).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledWith("/api/series-lists");

    fireEvent.click(screen.getByRole("button", { name: "Maratonadas" }));

    expect(putMock).toHaveBeenCalledWith("/api/series-lists/1/items/1396");
    // O submenu fecha assim que a adição é confirmada.
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());

    // Reabrindo, a lista aparece marcada como já adicionada (e desabilitada).
    fireEvent.click(screen.getByRole("button", { name: "Adicionar a uma lista" }));
    expect(await screen.findByRole("button", { name: "✓ Maratonadas" })).toBeDisabled();
  });

  it("mostra mensagem quando o usuário ainda não tem listas", async () => {
    getMock.mockResolvedValue({ lists: [] });
    render(<AddToSeriesListMenu tmdbId={1396} />);

    fireEvent.click(screen.getByRole("button", { name: "Adicionar a uma lista" }));

    expect(await screen.findByText("Você ainda não tem listas.")).toBeInTheDocument();
  });

  it("cria uma lista nova pelo '+ Nova lista' e já adiciona a série nela", async () => {
    getMock.mockResolvedValue({ lists: [] });
    postMock.mockResolvedValue({
      id: "2",
      name: "Quero assistir",
      description: null,
      itemCount: 0,
      createdAt: "",
      updatedAt: "",
    });
    putMock.mockResolvedValue(undefined);
    render(<AddToSeriesListMenu tmdbId={1396} />);

    fireEvent.click(screen.getByRole("button", { name: "Adicionar a uma lista" }));
    await screen.findByText("Você ainda não tem listas.");
    fireEvent.click(screen.getByRole("button", { name: "+ Nova lista" }));

    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Quero assistir" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith("/api/series-lists", {
        name: "Quero assistir",
        description: null,
      }),
    );
    expect(putMock).toHaveBeenCalledWith("/api/series-lists/2/items/1396");
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AddToListMenu } from "./AddToListMenu";

const { getMock, putMock } = vi.hoisted(() => ({ getMock: vi.fn(), putMock: vi.fn() }));

vi.mock("../lib/games-client", async () => {
  const actual = await vi.importActual<typeof import("../lib/games-client")>("../lib/games-client");
  return {
    ...actual,
    gamesClient: { get: getMock, put: putMock, post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  };
});

describe("AddToListMenu", () => {
  it("não busca as listas antes de abrir o menu", () => {
    render(<AddToListMenu igdbId={1942} />);

    expect(getMock).not.toHaveBeenCalled();
  });

  it("busca e mostra as listas ao abrir, adiciona ao clicar e fecha o submenu", async () => {
    getMock.mockResolvedValue({ lists: [{ id: "1", name: "Backlog", description: null, itemCount: 0, createdAt: "", updatedAt: "" }] });
    putMock.mockResolvedValue(undefined);
    render(<AddToListMenu igdbId={1942} />);

    fireEvent.click(screen.getByRole("button", { name: "Adicionar a uma lista" }));

    expect(await screen.findByRole("button", { name: "Backlog" })).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledWith("/api/lists");

    fireEvent.click(screen.getByRole("button", { name: "Backlog" }));

    expect(putMock).toHaveBeenCalledWith("/api/lists/1/items/1942");
    // O submenu fecha assim que a adição é confirmada.
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());

    // Reabrindo, a lista aparece marcada como já adicionada (e desabilitada).
    fireEvent.click(screen.getByRole("button", { name: "Adicionar a uma lista" }));
    expect(await screen.findByRole("button", { name: "✓ Backlog" })).toBeDisabled();
  });

  it("mostra mensagem quando o usuário ainda não tem listas", async () => {
    getMock.mockResolvedValue({ lists: [] });
    render(<AddToListMenu igdbId={1942} />);

    fireEvent.click(screen.getByRole("button", { name: "Adicionar a uma lista" }));

    expect(await screen.findByText("Você ainda não tem listas.")).toBeInTheDocument();
  });
});

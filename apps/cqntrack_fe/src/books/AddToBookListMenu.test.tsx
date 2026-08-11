import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AddToBookListMenu } from "./AddToBookListMenu";

const { getMock, putMock } = vi.hoisted(() => ({ getMock: vi.fn(), putMock: vi.fn() }));

vi.mock("../lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("../lib/api-client")>("../lib/api-client");
  return {
    ...actual,
    apiClient: { get: getMock, put: putMock, post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  };
});

describe("AddToBookListMenu", () => {
  it("não busca as listas antes de abrir o menu", () => {
    render(<AddToBookListMenu googleBooksId="PCq3AAAAQBAJ" />);

    expect(getMock).not.toHaveBeenCalled();
  });

  it("busca e mostra as listas ao abrir, adiciona ao clicar e fecha o submenu", async () => {
    getMock.mockResolvedValue({
      lists: [
        { id: "1", name: "Lidos em 2026", description: null, itemCount: 0, createdAt: "", updatedAt: "" },
      ],
    });
    putMock.mockResolvedValue(undefined);
    render(<AddToBookListMenu googleBooksId="PCq3AAAAQBAJ" />);

    fireEvent.click(screen.getByRole("button", { name: "Adicionar a uma lista" }));

    expect(await screen.findByRole("button", { name: "Lidos em 2026" })).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledWith("/api/books-lists");

    fireEvent.click(screen.getByRole("button", { name: "Lidos em 2026" }));

    expect(putMock).toHaveBeenCalledWith("/api/books-lists/1/items/PCq3AAAAQBAJ");
    // O submenu fecha assim que a adição é confirmada.
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());

    // Reabrindo, a lista aparece marcada como já adicionada (e desabilitada).
    fireEvent.click(screen.getByRole("button", { name: "Adicionar a uma lista" }));
    expect(await screen.findByRole("button", { name: "✓ Lidos em 2026" })).toBeDisabled();
  });

  it("mostra mensagem quando o usuário ainda não tem listas", async () => {
    getMock.mockResolvedValue({ lists: [] });
    render(<AddToBookListMenu googleBooksId="PCq3AAAAQBAJ" />);

    fireEvent.click(screen.getByRole("button", { name: "Adicionar a uma lista" }));

    expect(await screen.findByText("Você ainda não tem listas.")).toBeInTheDocument();
  });
});

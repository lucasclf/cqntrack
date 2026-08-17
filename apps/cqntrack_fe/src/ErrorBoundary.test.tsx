import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

function Bomb(): never {
  throw new Error("boom");
}

describe("ErrorBoundary", () => {
  it("renderiza os filhos normalmente quando não há erro", () => {
    render(
      <ErrorBoundary>
        <p>Conteúdo normal</p>
      </ErrorBoundary>,
    );

    expect(screen.getByText("Conteúdo normal")).toBeInTheDocument();
  });

  it("mostra um fallback em vez de derrubar a árvore inteira quando um filho lança", () => {
    // React loga o erro do componente no console mesmo com a boundary
    // capturando — silencia só pra não poluir a saída do teste.
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );

    expect(screen.getByRole("heading", { name: "Algo deu errado" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Recarregar" })).toBeInTheDocument();

    consoleError.mockRestore();
  });
});

import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it } from "vitest";
import { AppShell } from "./AppShell";

function renderShell(initialEntry: string) {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<p>conteúdo da home</p>} />
          <Route path="buscar" element={<p>conteúdo de busca</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("AppShell", () => {
  it("renderiza a navegação principal e o conteúdo da rota ativa", () => {
    renderShell("/");

    expect(screen.getByRole("navigation", { name: "Navegação principal" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Início/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Buscar/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Marcações/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Listas/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Conta/ })).toBeInTheDocument();
    expect(screen.getByText("conteúdo da home")).toBeInTheDocument();
  });

  it("marca o link ativo com aria-current quando a rota corresponde", () => {
    renderShell("/buscar");

    expect(screen.getByRole("link", { name: /Buscar/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /Início/ })).not.toHaveAttribute("aria-current");
  });
});

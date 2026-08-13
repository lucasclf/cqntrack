import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";

const { useSessionMock, signOutMock } = vi.hoisted(() => ({
  useSessionMock: vi.fn(),
  signOutMock: vi.fn(),
}));

vi.mock("../lib/auth-client", () => ({
  authClient: {
    useSession: useSessionMock,
    signOut: signOutMock,
  },
}));

function renderShell(initialEntry: string) {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<p>conteúdo da home</p>} />
          <Route path="jogos" element={<p>descobrir jogos</p>} />
          <Route path="series" element={<p>descobrir séries</p>} />
          <Route path="series/buscar" element={<p>conteúdo de busca de séries</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

function openAccountMenu() {
  fireEvent.click(screen.getByLabelText("Menu da conta"));
}

describe("AppShell", () => {
  beforeEach(() => {
    useSessionMock.mockReset();
    signOutMock.mockReset();
    useSessionMock.mockReturnValue({
      data: { user: { id: "1", username: "lucas" } },
      isPending: false,
    });
  });

  it("renderiza a navegação de mídias e o conteúdo da rota ativa", () => {
    renderShell("/");

    expect(screen.getByRole("navigation", { name: "Seções" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Jogos" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Séries" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Filmes" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Livros" })).toBeInTheDocument();
    expect(screen.getByText("conteúdo da home")).toBeInTheDocument();
  });

  it("aponta cada link de mídia pra sua seção (Descobrir, exceto livros que vai pra busca)", () => {
    renderShell("/");

    expect(screen.getByRole("link", { name: "Jogos" })).toHaveAttribute("href", "/jogos");
    expect(screen.getByRole("link", { name: "Séries" })).toHaveAttribute("href", "/series");
    expect(screen.getByRole("link", { name: "Filmes" })).toHaveAttribute("href", "/filmes");
    expect(screen.getByRole("link", { name: "Livros" })).toHaveAttribute("href", "/livros/buscar");
  });

  it("marca o link de mídia ativo com aria-current quando a rota corresponde", () => {
    renderShell("/series");

    expect(screen.getByRole("link", { name: "Séries" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Jogos" })).not.toHaveAttribute("aria-current");
  });

  it("fora de uma seção, não mostra o ícone de busca", () => {
    renderShell("/");

    expect(screen.queryByRole("link", { name: "Buscar" })).not.toBeInTheDocument();
  });

  it("dentro de uma seção, o ícone de busca aponta pra busca daquela seção", () => {
    renderShell("/series/buscar");

    expect(screen.getByRole("link", { name: "Buscar" })).toHaveAttribute("href", "/series/buscar");
    expect(screen.getByText("conteúdo de busca de séries")).toBeInTheDocument();
  });

  it("menu de conta: 'Minhas marcações'/'Minhas listas' seguem a seção ativa", () => {
    renderShell("/series/buscar");
    openAccountMenu();

    expect(screen.getByRole("menuitem", { name: "Minhas marcações" })).toHaveAttribute(
      "href",
      "/series/marcacoes",
    );
    expect(screen.getByRole("menuitem", { name: "Minhas listas" })).toHaveAttribute(
      "href",
      "/series/listas",
    );
  });

  it("fora de uma seção, o menu de conta usa jogos como padrão", () => {
    renderShell("/");
    openAccountMenu();

    expect(screen.getByRole("menuitem", { name: "Minhas marcações" })).toHaveAttribute(
      "href",
      "/jogos/marcacoes",
    );
    expect(screen.getByRole("menuitem", { name: "Minhas listas" })).toHaveAttribute(
      "href",
      "/jogos/listas",
    );
  });

  it("menu de conta mostra 'Ver meu perfil' apontando pro @username da sessão", () => {
    renderShell("/");
    openAccountMenu();

    expect(screen.getByRole("menuitem", { name: "Ver meu perfil" })).toHaveAttribute(
      "href",
      "/@lucas",
    );
  });

  it("sem username na sessão, não mostra 'Ver meu perfil'", () => {
    useSessionMock.mockReturnValue({ data: { user: { id: "1" } }, isPending: false });
    renderShell("/");
    openAccountMenu();

    expect(screen.queryByRole("menuitem", { name: "Ver meu perfil" })).not.toBeInTheDocument();
  });

  it("menu de conta tem 'Conta' e 'Sair'", () => {
    renderShell("/");
    openAccountMenu();

    expect(screen.getByRole("menuitem", { name: "Conta" })).toHaveAttribute("href", "/conta");
    expect(screen.getByRole("menuitem", { name: "Sair" })).toBeInTheDocument();
  });

  it("clicar em 'Sair' desconecta a sessão", () => {
    signOutMock.mockResolvedValue(undefined);
    renderShell("/");
    openAccountMenu();

    fireEvent.click(screen.getByRole("menuitem", { name: "Sair" }));

    expect(signOutMock).toHaveBeenCalled();
  });
});

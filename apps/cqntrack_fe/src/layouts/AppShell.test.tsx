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
          <Route path="jogos" element={<p>conteúdo de jogos</p>} />
          <Route path="series" element={<p>conteúdo de séries</p>} />
          <Route path="series/buscar" element={<p>conteúdo de busca de séries</p>} />
          <Route path="atividades" element={<p>conteúdo de atividades</p>} />
          <Route path="social" element={<p>conteúdo social</p>} />
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

  it("renderiza as 8 opções do header e o conteúdo da rota ativa", () => {
    renderShell("/");

    expect(screen.getByRole("navigation", { name: "Seções" })).toBeInTheDocument();
    for (const label of [
      "Continuar",
      "Séries",
      "Filmes",
      "Jogos",
      "Livros",
      "Mangás",
      "Atividades",
      "Social",
    ]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
    expect(screen.getByText("conteúdo da home")).toBeInTheDocument();
  });

  it("cada opção do header aponta pra sua própria rota (sem duplicar Descobrir/busca)", () => {
    renderShell("/");

    expect(screen.getByRole("link", { name: "Continuar" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Séries" })).toHaveAttribute("href", "/series");
    expect(screen.getByRole("link", { name: "Filmes" })).toHaveAttribute("href", "/filmes");
    expect(screen.getByRole("link", { name: "Jogos" })).toHaveAttribute("href", "/jogos");
    expect(screen.getByRole("link", { name: "Livros" })).toHaveAttribute("href", "/livros");
    expect(screen.getByRole("link", { name: "Mangás" })).toHaveAttribute("href", "/mangas");
    expect(screen.getByRole("link", { name: "Atividades" })).toHaveAttribute("href", "/atividades");
    expect(screen.getByRole("link", { name: "Social" })).toHaveAttribute("href", "/social");
  });

  it("marca a opção ativa com aria-current quando a rota corresponde", () => {
    renderShell("/series");

    expect(screen.getByRole("link", { name: "Séries" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Jogos" })).not.toHaveAttribute("aria-current");
  });

  it("não mostra ícone de busca no header (removido — busca vive dentro da aba Descobrir de cada seção)", () => {
    renderShell("/series/buscar");

    expect(screen.queryByRole("link", { name: "Buscar" })).not.toBeInTheDocument();
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

  it("menu de conta tem 'Conta' e 'Sair' (sem 'Amigos' — Social já é opção do header)", () => {
    renderShell("/");
    openAccountMenu();

    expect(screen.getByRole("menuitem", { name: "Conta" })).toHaveAttribute("href", "/conta");
    expect(screen.getByRole("menuitem", { name: "Sair" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Amigos" })).not.toBeInTheDocument();
  });

  it("clicar em 'Sair' desconecta a sessão", () => {
    signOutMock.mockResolvedValue(undefined);
    renderShell("/");
    openAccountMenu();

    fireEvent.click(screen.getByRole("menuitem", { name: "Sair" }));

    expect(signOutMock).toHaveBeenCalled();
  });

  it("sem avatar na sessão, mostra o ícone genérico", () => {
    renderShell("/");

    expect(screen.getByLabelText("Menu da conta").querySelector("img")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Menu da conta").querySelector("svg")).toBeInTheDocument();
  });

  it("com avatar na sessão, mostra a imagem em vez do ícone genérico", () => {
    useSessionMock.mockReturnValue({
      data: { user: { id: "1", username: "lucas", image: "https://cdn.example.com/avatar.png" } },
      isPending: false,
    });
    renderShell("/");

    const trigger = screen.getByLabelText("Menu da conta");
    expect(trigger.querySelector("img")).toHaveAttribute(
      "src",
      "https://cdn.example.com/avatar.png",
    );
    expect(trigger.querySelector("svg")).not.toBeInTheDocument();
  });
});

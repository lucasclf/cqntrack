import { fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { describe, expect, it, vi } from "vitest";
import { routes } from "./router";

const { useSessionMock } = vi.hoisted(() => ({ useSessionMock: vi.fn() }));

vi.mock("./lib/auth-client", () => ({
  authClient: {
    useSession: useSessionMock,
    signIn: { email: vi.fn() },
    signUp: { email: vi.fn() },
  },
}));

function renderApp(initialEntry: string) {
  const router = createMemoryRouter(routes, { initialEntries: [initialEntry] });
  render(<RouterProvider router={router} />);
}

describe("Roteamento do App", () => {
  it("redireciona para o login quando não há sessão", async () => {
    useSessionMock.mockReturnValue({ data: null, isPending: false });
    renderApp("/");

    expect(await screen.findByRole("heading", { name: "Entrar" })).toBeInTheDocument();
  });

  it("navega para /cadastro ao clicar em 'Criar conta'", async () => {
    useSessionMock.mockReturnValue({ data: null, isPending: false });
    renderApp("/login");

    fireEvent.click(screen.getByRole("link", { name: "Criar conta" }));

    expect(await screen.findByRole("heading", { name: "Criar conta" })).toBeInTheDocument();
  });

  it("renderiza a área logada quando há sessão", async () => {
    useSessionMock.mockReturnValue({ data: { user: { id: "1" } }, isPending: false });
    renderApp("/");

    // A marca "cqntrack" só existe no header (TopBar) — a Home não repete
    // o título no corpo.
    expect(await screen.findByRole("link", { name: "cqntrack" })).toBeInTheDocument();
  });
});

import { render, screen } from "@testing-library/react";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { describe, expect, it, vi } from "vitest";
import { RequireAuth } from "./RequireAuth";

const { useSessionMock } = vi.hoisted(() => ({ useSessionMock: vi.fn() }));

vi.mock("../lib/auth-client", () => ({
  authClient: { useSession: useSessionMock },
}));

function renderWithRouter() {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: <RequireAuth />,
        children: [{ index: true, element: <p>conteúdo protegido</p> }],
      },
      { path: "/login", element: <p>tela de login</p> },
    ],
    { initialEntries: ["/"] },
  );

  render(<RouterProvider router={router} />);
}

describe("RequireAuth", () => {
  it("mostra carregando enquanto a sessão está pendente", () => {
    useSessionMock.mockReturnValue({ data: null, isPending: true });
    renderWithRouter();

    expect(screen.getByText("Carregando...")).toBeInTheDocument();
  });

  it("redireciona para /login quando não há sessão", async () => {
    useSessionMock.mockReturnValue({ data: null, isPending: false });
    renderWithRouter();

    expect(await screen.findByText("tela de login")).toBeInTheDocument();
  });

  it("renderiza o conteúdo protegido quando há sessão", async () => {
    useSessionMock.mockReturnValue({ data: { user: { id: "1" } }, isPending: false });
    renderWithRouter();

    expect(await screen.findByText("conteúdo protegido")).toBeInTheDocument();
  });
});

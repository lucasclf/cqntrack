import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PublicLayout } from "./PublicLayout";

const { useSessionMock } = vi.hoisted(() => ({ useSessionMock: vi.fn() }));

vi.mock("../lib/auth-client", () => ({
  authClient: {
    useSession: useSessionMock,
    signOut: vi.fn(),
  },
}));

function renderLayout() {
  render(
    <MemoryRouter>
      <PublicLayout>
        <p>conteúdo público</p>
      </PublicLayout>
    </MemoryRouter>,
  );
}

describe("PublicLayout", () => {
  beforeEach(() => {
    useSessionMock.mockReset();
  });

  it("visitante anônimo vê a casca mínima (sem navegação de mídias/conta)", () => {
    useSessionMock.mockReturnValue({ data: null, isPending: false });
    renderLayout();

    expect(screen.getByText("conteúdo público")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Seções" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Menu da conta")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /cqntrack/ })).toHaveAttribute("href", "/login");
  });

  it("visitante logado vê a barra superior completa (TopBar), mesmo numa tela pública", () => {
    useSessionMock.mockReturnValue({
      data: { user: { id: "1", username: "lucas" } },
      isPending: false,
    });
    renderLayout();

    expect(screen.getByText("conteúdo público")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Seções" })).toBeInTheDocument();
    expect(screen.getByLabelText("Menu da conta")).toBeInTheDocument();
  });
});

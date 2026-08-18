import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForgotPassword } from "./ForgotPassword";

const { requestPasswordResetMock } = vi.hoisted(() => ({
  requestPasswordResetMock: vi.fn(),
}));

vi.mock("./lib/auth-client", () => ({
  authClient: {
    requestPasswordReset: requestPasswordResetMock,
  },
}));

function renderForgotPassword() {
  render(
    <MemoryRouter>
      <ForgotPassword />
    </MemoryRouter>,
  );
}

describe("ForgotPassword", () => {
  beforeEach(() => {
    requestPasswordResetMock.mockReset().mockResolvedValue({ data: { status: true }, error: null });
  });

  it("renderiza o campo de e-mail", () => {
    renderForgotPassword();

    expect(screen.getByRole("heading", { name: "Esqueci minha senha" })).toBeInTheDocument();
    expect(screen.getByLabelText("E-mail")).toBeInTheDocument();
  });

  it("chama requestPasswordReset com o e-mail e o redirectTo certo", async () => {
    renderForgotPassword();

    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "teste@cqntrack.dev" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar link" }));

    await waitFor(() => {
      expect(requestPasswordResetMock).toHaveBeenCalledWith({
        email: "teste@cqntrack.dev",
        redirectTo: `${window.location.origin}/redefinir-senha`,
      });
    });
  });

  it("mostra a mesma mensagem de sucesso, mesmo sem saber se o e-mail existe", async () => {
    renderForgotPassword();

    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "naoexiste@cqntrack.dev" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar link" }));

    expect(await screen.findByRole("heading", { name: "Confira seu e-mail" })).toBeInTheDocument();
  });
});

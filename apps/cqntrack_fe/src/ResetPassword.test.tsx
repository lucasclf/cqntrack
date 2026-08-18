import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResetPassword } from "./ResetPassword";

const { resetPasswordMock, navigateMock } = vi.hoisted(() => ({
  resetPasswordMock: vi.fn(),
  navigateMock: vi.fn(),
}));

vi.mock("./lib/auth-client", () => ({
  authClient: {
    resetPassword: resetPasswordMock,
  },
}));

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return { ...actual, useNavigate: () => navigateMock };
});

function renderResetPassword(initialEntry: string) {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ResetPassword />
    </MemoryRouter>,
  );
}

describe("ResetPassword", () => {
  beforeEach(() => {
    resetPasswordMock.mockReset().mockResolvedValue({ data: { status: true }, error: null });
    navigateMock.mockReset();
  });

  it("sem token na URL, mostra tela de link inválido em vez do formulário", () => {
    renderResetPassword("/redefinir-senha");

    expect(screen.getByRole("heading", { name: "Link inválido" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Nova senha")).not.toBeInTheDocument();
  });

  it("com ?error=..., mostra tela de link inválido mesmo se veio um token junto", () => {
    renderResetPassword("/redefinir-senha?token=abc&error=INVALID_TOKEN");

    expect(screen.getByRole("heading", { name: "Link inválido" })).toBeInTheDocument();
  });

  it("com token válido na URL, mostra o formulário de nova senha", () => {
    renderResetPassword("/redefinir-senha?token=abc123");

    expect(screen.getByRole("heading", { name: "Escolher nova senha" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nova senha")).toBeInTheDocument();
  });

  it("submete a nova senha com o token da URL e navega pro login com sucesso", async () => {
    renderResetPassword("/redefinir-senha?token=abc123");

    fireEvent.change(screen.getByLabelText("Nova senha"), { target: { value: "senhaNova456" } });
    fireEvent.click(screen.getByRole("button", { name: "Redefinir senha" }));

    await waitFor(() => {
      expect(resetPasswordMock).toHaveBeenCalledWith({
        newPassword: "senhaNova456",
        token: "abc123",
      });
    });
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/login?reset=1"));
  });

  it("mostra erro quando resetPassword falha (ex.: token expirou entre carregar a página e enviar)", async () => {
    resetPasswordMock.mockResolvedValue({ data: null, error: { message: "invalid token" } });
    renderResetPassword("/redefinir-senha?token=abc123");

    fireEvent.change(screen.getByLabelText("Nova senha"), { target: { value: "senhaNova456" } });
    fireEvent.click(screen.getByRole("button", { name: "Redefinir senha" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível redefinir a senha. Peça um link novo e tente de novo.",
    );
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("mostra erro de validação sem chamar a API quando a senha é curta demais", () => {
    renderResetPassword("/redefinir-senha?token=abc123");

    fireEvent.change(screen.getByLabelText("Nova senha"), { target: { value: "123" } });
    fireEvent.click(screen.getByRole("button", { name: "Redefinir senha" }));

    expect(screen.getByRole("alert")).toHaveTextContent("pelo menos 8 caracteres");
    expect(resetPasswordMock).not.toHaveBeenCalled();
  });
});

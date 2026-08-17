import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Account } from "./Account";

const { useSessionMock, updateUserMock, changePasswordMock, signOutMock, navigateMock } =
  vi.hoisted(() => ({
    useSessionMock: vi.fn(),
    updateUserMock: vi.fn(),
    changePasswordMock: vi.fn(),
    signOutMock: vi.fn(),
    navigateMock: vi.fn(),
  }));

vi.mock("./lib/auth-client", () => ({
  authClient: {
    useSession: useSessionMock,
    updateUser: updateUserMock,
    changePassword: changePasswordMock,
    signOut: signOutMock,
  },
}));

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return { ...actual, useNavigate: () => navigateMock };
});

function renderAccount() {
  render(
    <MemoryRouter>
      <Account />
    </MemoryRouter>,
  );
}

const USER = { id: "1", name: "Teste", email: "teste@cqntrack.dev", username: "teste_user" };

describe("Account", () => {
  beforeEach(() => {
    updateUserMock.mockReset();
    changePasswordMock.mockReset();
    signOutMock.mockReset();
    navigateMock.mockReset();
    useSessionMock.mockReturnValue({ data: { user: USER } });
  });

  it("mostra username, e-mail e o nome pré-preenchido", () => {
    renderAccount();

    expect(screen.getByText("@teste_user")).toBeInTheDocument();
    expect(screen.getByText("teste@cqntrack.dev")).toBeInTheDocument();
    expect(screen.getByLabelText("Nome de exibição")).toHaveValue("Teste");
  });

  it("salva o nome de exibição", async () => {
    updateUserMock.mockResolvedValue({ error: null });
    renderAccount();

    fireEvent.change(screen.getByLabelText("Nome de exibição"), { target: { value: "Novo Nome" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar nome" }));

    await waitFor(() => expect(updateUserMock).toHaveBeenCalledWith({ name: "Novo Nome" }));
    expect(await screen.findByText("Nome atualizado.")).toBeInTheDocument();
  });

  it("altera a senha e limpa os campos", async () => {
    changePasswordMock.mockResolvedValue({ error: null });
    renderAccount();

    fireEvent.change(screen.getByLabelText("Senha atual"), { target: { value: "senhaAntiga1" } });
    fireEvent.change(screen.getByLabelText("Nova senha"), { target: { value: "senhaNova123" } });
    fireEvent.click(screen.getByRole("button", { name: "Alterar senha" }));

    await waitFor(() =>
      expect(changePasswordMock).toHaveBeenCalledWith({
        currentPassword: "senhaAntiga1",
        newPassword: "senhaNova123",
        revokeOtherSessions: true,
      }),
    );
    expect(await screen.findByText("Senha alterada.")).toBeInTheDocument();
    expect(screen.getByLabelText("Senha atual")).toHaveValue("");
    expect(screen.getByLabelText("Nova senha")).toHaveValue("");
  });

  it("mostra erro quando a troca de senha falha", async () => {
    changePasswordMock.mockResolvedValue({ error: { message: "invalid" } });
    renderAccount();

    fireEvent.change(screen.getByLabelText("Senha atual"), { target: { value: "senhaErrada" } });
    fireEvent.change(screen.getByLabelText("Nova senha"), { target: { value: "senhaNova123" } });
    fireEvent.click(screen.getByRole("button", { name: "Alterar senha" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Senha atual incorreta");
  });

  it("mostra a seção de importar dados com as opções de CSV do Filmow e do tvtime", () => {
    renderAccount();

    expect(screen.getByRole("heading", { name: "Importar dados" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Filmes assistidos (Filmow, CSV)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Episódios assistidos (tvtime, CSV)" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Escolher arquivo CSV")).toHaveLength(2);
  });

  it("desloga e navega pro login", async () => {
    signOutMock.mockResolvedValue(undefined);
    renderAccount();

    fireEvent.click(screen.getByRole("button", { name: "Sair da conta" }));

    await waitFor(() => expect(signOutMock).toHaveBeenCalled());
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/login"));
  });
});

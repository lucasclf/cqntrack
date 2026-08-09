import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Signup } from "./Signup";

const { signUpEmailMock, navigateMock } = vi.hoisted(() => ({
  signUpEmailMock: vi.fn(),
  navigateMock: vi.fn(),
}));

vi.mock("./lib/auth-client", () => ({
  authClient: {
    signUp: { email: signUpEmailMock },
  },
}));

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return { ...actual, useNavigate: () => navigateMock };
});

function renderSignup() {
  render(
    <MemoryRouter>
      <Signup />
    </MemoryRouter>,
  );
}

function fillValidForm() {
  fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Teste" } });
  fireEvent.change(screen.getByLabelText("Nome de usuário"), { target: { value: "teste_user" } });
  fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "teste@cqntrack.dev" } });
  fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "segredo123" } });
}

describe("Signup", () => {
  beforeEach(() => {
    signUpEmailMock.mockReset();
    navigateMock.mockReset();
  });

  it("renderiza os campos do formulário", () => {
    renderSignup();

    expect(screen.getByRole("heading", { name: "Criar conta" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nome")).toBeInTheDocument();
    expect(screen.getByLabelText("Nome de usuário")).toBeInTheDocument();
    expect(screen.getByLabelText("E-mail")).toBeInTheDocument();
    expect(screen.getByLabelText("Senha")).toBeInTheDocument();
  });

  it("chama signUp.email com os dados do formulário e navega para / em caso de sucesso", async () => {
    signUpEmailMock.mockResolvedValue({ error: null });
    renderSignup();

    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));

    await waitFor(() => {
      expect(signUpEmailMock).toHaveBeenCalledWith({
        name: "Teste",
        username: "teste_user",
        email: "teste@cqntrack.dev",
        password: "segredo123",
      });
    });
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/"));
  });

  it("mostra erro quando signUp.email falha", async () => {
    signUpEmailMock.mockResolvedValue({ error: { message: "email já existe" } });
    renderSignup();

    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível criar a conta. O e-mail ou nome de usuário já estão em uso.",
    );
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("mostra erro de validação quando o username tem caracteres inválidos", () => {
    renderSignup();

    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Teste" } });
    fireEvent.change(screen.getByLabelText("Nome de usuário"), { target: { value: "ab" } }); // curto demais
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "teste@cqntrack.dev" } });
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "segredo123" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));

    expect(screen.getByRole("alert")).toHaveTextContent(/nome de usuário/);
    expect(signUpEmailMock).not.toHaveBeenCalled();
  });
});

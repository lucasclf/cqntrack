import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Login } from "./Login";

const { signInEmailMock, navigateMock, refetchSessionMock } = vi.hoisted(() => ({
  signInEmailMock: vi.fn(),
  navigateMock: vi.fn(),
  refetchSessionMock: vi.fn(),
}));

vi.mock("./lib/auth-client", () => ({
  authClient: {
    signIn: { email: signInEmailMock },
    useSession: () => ({ refetch: refetchSessionMock }),
  },
}));

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return { ...actual, useNavigate: () => navigateMock };
});

function renderLogin(initialEntry = "/login") {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Login />
    </MemoryRouter>,
  );
}

describe("Login", () => {
  beforeEach(() => {
    signInEmailMock.mockReset();
    navigateMock.mockReset();
    refetchSessionMock.mockReset().mockResolvedValue(undefined);
  });

  it("renderiza os campos do formulário", () => {
    renderLogin();

    expect(screen.getByRole("heading", { name: "Entrar" })).toBeInTheDocument();
    expect(screen.getByLabelText("E-mail")).toBeInTheDocument();
    expect(screen.getByLabelText("Senha")).toBeInTheDocument();
  });

  it("permite digitar e-mail e senha", () => {
    renderLogin();

    const emailInput = screen.getByLabelText("E-mail") as HTMLInputElement;
    const passwordInput = screen.getByLabelText("Senha") as HTMLInputElement;

    fireEvent.change(emailInput, { target: { value: "teste@cqntrack.dev" } });
    fireEvent.change(passwordInput, { target: { value: "segredo123" } });

    expect(emailInput.value).toBe("teste@cqntrack.dev");
    expect(passwordInput.value).toBe("segredo123");
  });

  it("chama signIn.email com os dados do formulário e navega para / em caso de sucesso", async () => {
    signInEmailMock.mockResolvedValue({ error: null });
    renderLogin();

    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "teste@cqntrack.dev" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "segredo123" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Manter conectado" }));
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => {
      expect(signInEmailMock).toHaveBeenCalledWith({
        email: "teste@cqntrack.dev",
        password: "segredo123",
        rememberMe: true,
      });
    });
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/"));
    // A sessão compartilhada precisa ser atualizada antes de navegar, senão
    // RequireAuth ainda vê o estado antigo (sem sessão) e manda de volta
    // pro login — ver comentário em Login.tsx.
    expect(refetchSessionMock).toHaveBeenCalled();
  });

  it("mostra erro quando signIn.email falha", async () => {
    signInEmailMock.mockResolvedValue({ error: { message: "invalid" } });
    renderLogin();

    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "teste@cqntrack.dev" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "senhaerrada" } });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("E-mail ou senha inválidos.");
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("mostra mensagem específica quando o login falha por e-mail não verificado", async () => {
    signInEmailMock.mockResolvedValue({ error: { code: "EMAIL_NOT_VERIFIED" } });
    renderLogin();

    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "teste@cqntrack.dev" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "segredo123" } });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Confirme seu e-mail antes de entrar — reenviamos o link de confirmação.",
    );
  });

  it("mostra banner de sucesso quando vem de ?verified=1 (link de confirmação clicado)", () => {
    renderLogin("/login?verified=1");

    expect(screen.getByText("E-mail confirmado! Faça login.")).toBeInTheDocument();
  });

  it("mostra mensagem de link expirado quando vem de ?error=TOKEN_EXPIRED", () => {
    renderLogin("/login?error=TOKEN_EXPIRED");

    expect(screen.getByRole("alert")).toHaveTextContent(/link de confirmação expirou/);
  });

  it("mostra erro de validação sem chamar signIn.email quando a senha é curta demais", () => {
    renderLogin();

    // E-mail com formato válido (passa na validação nativa do <input type="email">);
    // só o Zod barra pela senha curta, que é o que queremos exercitar aqui.
    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "teste@cqntrack.dev" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "123" } });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(screen.getByRole("alert")).toHaveTextContent(/e-mail válido/);
    expect(signInEmailMock).not.toHaveBeenCalled();
  });
});

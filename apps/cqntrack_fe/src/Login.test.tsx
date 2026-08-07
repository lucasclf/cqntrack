import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Login } from "./Login";

describe("Login", () => {
  it("renderiza os campos do formulário", () => {
    render(<Login onNavigateToUnavailable={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Entrar" })).toBeInTheDocument();
    expect(screen.getByLabelText("E-mail")).toBeInTheDocument();
    expect(screen.getByLabelText("Senha")).toBeInTheDocument();
  });

  it("permite digitar e-mail e senha", () => {
    render(<Login onNavigateToUnavailable={vi.fn()} />);

    const emailInput = screen.getByLabelText("E-mail") as HTMLInputElement;
    const passwordInput = screen.getByLabelText("Senha") as HTMLInputElement;

    fireEvent.change(emailInput, { target: { value: "teste@cqntrack.dev" } });
    fireEvent.change(passwordInput, { target: { value: "segredo123" } });

    expect(emailInput.value).toBe("teste@cqntrack.dev");
    expect(passwordInput.value).toBe("segredo123");
  });

  it("não segue o comportamento padrão de submit (sem backend ainda)", () => {
    render(<Login onNavigateToUnavailable={vi.fn()} />);

    const form = screen.getByRole("button", { name: "Entrar" }).closest("form");
    expect(form).not.toBeNull();

    // dispatchEvent retorna false quando algum handler chamou preventDefault().
    const defaultNotPrevented = fireEvent.submit(form as HTMLFormElement);
    expect(defaultNotPrevented).toBe(false);
  });

  it("aciona a navegação para a página de indisponível ao clicar nos links", () => {
    const onNavigateToUnavailable = vi.fn();
    render(<Login onNavigateToUnavailable={onNavigateToUnavailable} />);

    fireEvent.click(screen.getByRole("link", { name: "Esqueci minha senha" }));
    fireEvent.click(screen.getByRole("link", { name: "Criar conta" }));

    expect(onNavigateToUnavailable).toHaveBeenCalledTimes(2);
  });
});

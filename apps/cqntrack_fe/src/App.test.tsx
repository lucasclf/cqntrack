import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("navega do login para a página de indisponível e volta", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "Entrar" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "Criar conta" }));
    expect(screen.getByRole("heading", { name: "Ainda não disponível" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Voltar para o login" }));
    expect(screen.getByRole("heading", { name: "Entrar" })).toBeInTheDocument();
  });
});

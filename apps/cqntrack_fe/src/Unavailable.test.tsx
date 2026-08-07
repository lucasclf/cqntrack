import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Unavailable } from "./Unavailable";

describe("Unavailable", () => {
  it("renderiza a imagem e o botão de voltar", () => {
    render(<Unavailable onBack={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Ainda não disponível" })).toBeInTheDocument();
    expect(screen.getByRole("img")).toBeInTheDocument();
  });

  it("chama onBack ao clicar em voltar", () => {
    const onBack = vi.fn();
    render(<Unavailable onBack={onBack} />);

    fireEvent.click(screen.getByRole("button", { name: "Voltar para o login" }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

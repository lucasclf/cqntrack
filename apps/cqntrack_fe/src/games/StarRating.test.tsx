import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StarRating } from "./StarRating";

describe("StarRating", () => {
  it("sem onChange, não renderiza botões clicáveis (somente leitura)", () => {
    render(<StarRating value={3.5} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("3.5")).toBeInTheDocument();
  });

  it("clicar na metade esquerda de uma estrela seleciona meia nota", () => {
    const onChange = vi.fn();
    render(<StarRating value={null} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "2.5 estrelas" }));
    expect(onChange).toHaveBeenCalledWith(2.5);
  });

  it("clicar na metade direita de uma estrela seleciona nota cheia", () => {
    const onChange = vi.fn();
    render(<StarRating value={null} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "3 estrelas" }));
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it("clicar na nota já selecionada remove a nota", () => {
    const onChange = vi.fn();
    render(<StarRating value={4} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "4 estrelas" }));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});

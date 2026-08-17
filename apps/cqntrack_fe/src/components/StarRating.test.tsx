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

  it("foco num botão de estrela mostra o mesmo preview visual do mouse", () => {
    const { container } = render(<StarRating value={null} onChange={vi.fn()} />);
    const thirdStarButton = screen.getByRole("button", { name: "3 estrelas" });

    fireEvent.focus(thirdStarButton);

    const fillClips = container.querySelectorAll<HTMLElement>('[class*="starFillClip"]');
    expect(fillClips[2]?.style.width).toBe("100%");
  });

  it("tirar o foco do grupo de estrelas limpa o preview", () => {
    render(
      <div>
        <StarRating value={null} onChange={vi.fn()} />
        <button type="button">fora</button>
      </div>,
    );
    const thirdStarButton = screen.getByRole("button", { name: "3 estrelas" });
    const outsideButton = screen.getByRole("button", { name: "fora" });

    fireEvent.focus(thirdStarButton);
    fireEvent.blur(thirdStarButton, { relatedTarget: outsideButton });

    const fillClips = document.querySelectorAll<HTMLElement>('[class*="starFillClip"]');
    expect(fillClips[2]?.style.width).toBe("0%");
  });
});

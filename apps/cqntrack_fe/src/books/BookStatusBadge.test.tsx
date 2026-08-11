import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BookStatusBadge } from "./BookStatusBadge";

describe("BookStatusBadge", () => {
  it("sem onChange, renderiza um badge estático com o rótulo do status", () => {
    render(<BookStatusBadge status="reading" />);

    expect(screen.getByText("Lendo")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("sem onChange e sem status, não renderiza nada", () => {
    const { container } = render(<BookStatusBadge status={null} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("com onChange, renderiza os 4 status e marca o ativo", () => {
    const onChange = vi.fn();
    render(<BookStatusBadge status="read" onChange={onChange} />);

    expect(screen.getByRole("button", { name: "Lido" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Lendo" })).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(screen.getByRole("button", { name: "Abandonado" }));
    expect(onChange).toHaveBeenCalledWith("dropped");
  });

  it("clicar no status já selecionado desmarca (chama onChange com null)", () => {
    const onChange = vi.fn();
    render(<BookStatusBadge status="read" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Lido" }));

    expect(onChange).toHaveBeenCalledWith(null);
  });
});

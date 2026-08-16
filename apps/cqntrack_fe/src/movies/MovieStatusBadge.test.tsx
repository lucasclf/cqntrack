import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MovieStatusBadge } from "./MovieStatusBadge";

describe("MovieStatusBadge", () => {
  it("sem onChange, renderiza um badge estático com o rótulo do status", () => {
    render(<MovieStatusBadge status="watched" />);

    expect(screen.getByText("Já vi")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("sem onChange e sem status, não renderiza nada", () => {
    const { container } = render(<MovieStatusBadge status={null} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("com onChange, renderiza os 2 status e marca o ativo", () => {
    const onChange = vi.fn();
    render(<MovieStatusBadge status="watched" onChange={onChange} />);

    expect(screen.getByRole("button", { name: "Já vi" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Quero ver" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    fireEvent.click(screen.getByRole("button", { name: "Quero ver" }));
    expect(onChange).toHaveBeenCalledWith("want_to_watch");
  });

  it("clicar no status já selecionado desmarca (chama onChange com null)", () => {
    const onChange = vi.fn();
    render(<MovieStatusBadge status="watched" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Já vi" }));

    expect(onChange).toHaveBeenCalledWith(null);
  });
});

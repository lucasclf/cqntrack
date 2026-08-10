import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SeriesStatusBadge } from "./SeriesStatusBadge";

describe("SeriesStatusBadge", () => {
  it("sem onChange, renderiza um badge estático com o rótulo do status", () => {
    render(<SeriesStatusBadge status="watching" />);

    expect(screen.getByText("Assistindo")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("sem onChange e sem status, não renderiza nada", () => {
    const { container } = render(<SeriesStatusBadge status={null} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("com onChange, renderiza os 4 status e marca o ativo", () => {
    const onChange = vi.fn();
    render(<SeriesStatusBadge status="completed" onChange={onChange} />);

    expect(screen.getByRole("button", { name: "Completo" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Assistindo" })).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(screen.getByRole("button", { name: "Abandonei" }));
    expect(onChange).toHaveBeenCalledWith("dropped");
  });

  it("clicar no status já selecionado desmarca (chama onChange com null)", () => {
    const onChange = vi.fn();
    render(<SeriesStatusBadge status="completed" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Completo" }));

    expect(onChange).toHaveBeenCalledWith(null);
  });
});

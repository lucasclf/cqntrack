import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StatusBadge } from "./StatusBadge";

describe("StatusBadge", () => {
  it("sem onChange, renderiza um badge estático com o rótulo do status", () => {
    render(<StatusBadge status="playing" />);

    expect(screen.getByText("Jogando")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("sem onChange e sem status, não renderiza nada", () => {
    const { container } = render(<StatusBadge status={null} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("com onChange, renderiza os 5 status e marca o ativo", () => {
    const onChange = vi.fn();
    render(<StatusBadge status="completed" onChange={onChange} />);

    expect(screen.getByRole("button", { name: "Finalizado" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Jogando" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    fireEvent.click(screen.getByRole("button", { name: "Platinado" }));
    expect(onChange).toHaveBeenCalledWith("platinum");
  });

  it("clicar no status já selecionado desmarca (chama onChange com null)", () => {
    const onChange = vi.fn();
    render(<StatusBadge status="completed" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Finalizado" }));

    expect(onChange).toHaveBeenCalledWith(null);
  });
});

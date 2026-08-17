import { fireEvent, render, screen } from "@testing-library/react";
import { useRef, useState } from "react";
import { describe, expect, it } from "vitest";
import { useCloseOnOutsideClick } from "./useCloseOnOutsideClick";

function TestMenu() {
  const [open, setOpen] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  useCloseOnOutsideClick(ref, open, () => setOpen(false));

  return (
    <div>
      <div ref={ref} data-testid="menu">
        {open ? "aberto" : "fechado"}
      </div>
      <button type="button">fora do menu</button>
    </div>
  );
}

describe("useCloseOnOutsideClick", () => {
  it("fecha ao clicar fora do elemento", () => {
    render(<TestMenu />);
    expect(screen.getByTestId("menu")).toHaveTextContent("aberto");

    fireEvent.mouseDown(screen.getByRole("button", { name: "fora do menu" }));

    expect(screen.getByTestId("menu")).toHaveTextContent("fechado");
  });

  it("não fecha ao clicar dentro do elemento", () => {
    render(<TestMenu />);

    fireEvent.mouseDown(screen.getByTestId("menu"));

    expect(screen.getByTestId("menu")).toHaveTextContent("aberto");
  });

  it("fecha ao apertar Esc", () => {
    render(<TestMenu />);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.getByTestId("menu")).toHaveTextContent("fechado");
  });
});

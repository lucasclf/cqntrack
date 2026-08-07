import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ThemeToggle } from "./ThemeToggle";

describe("ThemeToggle", () => {
  it("alterna o atributo data-theme do documento ao clicar", () => {
    render(<ThemeToggle />);

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");

    fireEvent.click(screen.getByRole("button", { name: "Alternar tema claro/escuro" }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");

    fireEvent.click(screen.getByRole("button", { name: "Alternar tema claro/escuro" }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });
});

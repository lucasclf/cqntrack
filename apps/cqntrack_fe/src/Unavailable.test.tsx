import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { Unavailable } from "./Unavailable";

describe("Unavailable", () => {
  it("renderiza a imagem e o link de volta para o login", () => {
    render(
      <MemoryRouter>
        <Unavailable />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Ainda não disponível" })).toBeInTheDocument();
    expect(screen.getByRole("img")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar para o login" })).toHaveAttribute(
      "href",
      "/login",
    );
  });
});

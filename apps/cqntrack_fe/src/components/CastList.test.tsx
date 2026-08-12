import type { CastMember } from "@cqntrack/shared";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { CastList } from "./CastList";

const CAST: CastMember[] = [
  {
    personId: 6193,
    name: "Leonardo DiCaprio",
    character: "Dom Cobb",
    profileUrl: "https://image.tmdb.org/t/p/w185/dicaprio.jpg",
  },
  { personId: 24045, name: "Joseph Gordon-Levitt", character: "Arthur", profileUrl: null },
];

function renderList(cast: CastMember[] = CAST) {
  return render(
    <MemoryRouter>
      <CastList title="Elenco" cast={cast} />
    </MemoryRouter>,
  );
}

describe("CastList", () => {
  it("não renderiza nada quando o elenco está vazio", () => {
    const { container } = renderList([]);

    expect(container).toBeEmptyDOMElement();
  });

  it("mostra cada membro do elenco com nome e personagem, linkando pra página da pessoa", () => {
    renderList();

    expect(screen.getByRole("heading", { name: "Elenco" })).toBeInTheDocument();
    expect(screen.getByText("Leonardo DiCaprio")).toBeInTheDocument();
    expect(screen.getByText("Dom Cobb")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Leonardo DiCaprio/ })).toHaveAttribute(
      "href",
      "/pessoas/6193",
    );
  });

  it("lida com foto ausente sem quebrar", () => {
    const { container } = renderList();

    expect(screen.getByText("Joseph Gordon-Levitt")).toBeInTheDocument();
    // Só quem tem profileUrl vira <img> — o outro cai no placeholder (<div>).
    expect(container.querySelectorAll("img")).toHaveLength(1);
  });
});

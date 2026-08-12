import type { CrewMember } from "@cqntrack/shared";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { CrewList } from "./CrewList";

function renderList(crew: (CrewMember & { episodeCount?: number })[], title = "Direção") {
  return render(
    <MemoryRouter>
      <CrewList title={title} crew={crew} />
    </MemoryRouter>,
  );
}

describe("CrewList", () => {
  it("não renderiza nada quando a lista está vazia", () => {
    const { container } = renderList([]);

    expect(container).toBeEmptyDOMElement();
  });

  it("mostra o diretor de um filme (sem contagem de episódios), linkando pra página da pessoa", () => {
    renderList([
      {
        personId: 525,
        name: "Christopher Nolan",
        profileUrl: "https://image.tmdb.org/t/p/w185/nolan.jpg",
      },
    ]);

    expect(screen.getByRole("heading", { name: "Direção" })).toBeInTheDocument();
    expect(screen.getByText("Christopher Nolan")).toBeInTheDocument();
    expect(screen.queryByText(/episódios/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Christopher Nolan/ })).toHaveAttribute(
      "href",
      "/pessoas/525",
    );
  });

  it("mostra a contagem de episódios quando presente (direção de série)", () => {
    renderList([
      { personId: 29779, name: "Michelle MacLaren", profileUrl: null, episodeCount: 11 },
    ]);

    expect(screen.getByText(/Michelle MacLaren/)).toBeInTheDocument();
    expect(screen.getByText("(11 episódios)")).toBeInTheDocument();
  });

  it("usa o título informado (ex.: 'Criado por' pra série)", () => {
    renderList(
      [{ personId: 66633, name: "Vince Gilligan", profileUrl: null }],
      "Criado por",
    );

    expect(screen.getByRole("heading", { name: "Criado por" })).toBeInTheDocument();
  });
});

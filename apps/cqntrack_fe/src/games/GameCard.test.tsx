import type { GameSummary } from "@cqntrack/shared";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { GameCard } from "./GameCard";

const BASE_GAME: GameSummary = {
  igdbId: 1942,
  name: "The Witcher 3: Wild Hunt",
  coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/coaarl.jpg",
  firstReleaseDate: "2015-05-19",
  platforms: ["PC (Microsoft Windows)", "PlayStation 4"],
  genres: ["Role-playing (RPG)"],
  rating: 92.76,
};

function renderCard(game: GameSummary) {
  render(
    <MemoryRouter>
      <GameCard game={game} />
    </MemoryRouter>,
  );
}

describe("GameCard", () => {
  it("linka pro detalhe do jogo e mostra nome, ano, plataforma e nota arredondada", () => {
    renderCard(BASE_GAME);

    expect(screen.getByRole("link")).toHaveAttribute("href", "/jogos/1942");
    expect(screen.getByText("The Witcher 3: Wild Hunt")).toBeInTheDocument();
    expect(screen.getByText(/2015/)).toBeInTheDocument();
    expect(screen.getByText(/PC \(Microsoft Windows\)/)).toBeInTheDocument();
    expect(screen.getByText(/\+1/)).toBeInTheDocument();
    expect(screen.getByText("93")).toBeInTheDocument();
  });

  it("lida com capa, nota, plataforma e data ausentes sem quebrar", () => {
    renderCard({
      ...BASE_GAME,
      coverUrl: null,
      rating: null,
      platforms: [],
      firstReleaseDate: null,
    });

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("Data desconhecida")).toBeInTheDocument();
  });
});

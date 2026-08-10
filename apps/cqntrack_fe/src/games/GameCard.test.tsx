import type { GameEntry, GameSummary } from "@cqntrack/shared";
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

function renderCard(game: GameSummary, entry?: GameEntry) {
  return render(
    <MemoryRouter>
      <GameCard game={game} entry={entry} />
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

  it("mostra status, nota pessoal e selo de favorito quando há entry", () => {
    renderCard(BASE_GAME, {
      id: "1",
      status: "completed",
      rating: 4.5,
      favoriteSlot: 2,
      platforms: ["PC"],
      review: null,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(screen.getByText("Finalizado")).toBeInTheDocument();
    expect(screen.getByText("★ 4.5")).toBeInTheDocument();
    expect(screen.getByLabelText("Favoritado")).toBeInTheDocument();
  });

  it("reserva a linha de status/nota mesmo quando a entry não tem nenhum dos dois", () => {
    // Favoritar não define status nem nota — sem isso, esse card fica mais
    // baixo que os vizinhos que têm status/nota, quebrando o grid (bug real).
    const { container } = renderCard(BASE_GAME, {
      id: "1",
      status: null,
      rating: null,
      favoriteSlot: 1,
      platforms: null,
      review: null,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(container.querySelector("p:last-child")).toBeEmptyDOMElement();
  });
});

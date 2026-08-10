import type { SeriesEntry, SeriesSummary } from "@cqntrack/shared";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { SeriesCard } from "./SeriesCard";

const BASE_SERIES: SeriesSummary = {
  tmdbId: 1396,
  name: "Breaking Bad",
  posterUrl: "https://image.tmdb.org/t/p/w342/anFx9aTOOYqgS3v7x3R84Kz67ly.jpg",
  firstAirDate: "2008-01-20",
  genres: ["Drama", "Crime"],
  numberOfSeasons: 5,
  numberOfEpisodes: 62,
  rating: 8.947,
};

function renderCard(series: SeriesSummary, entry?: SeriesEntry) {
  return render(
    <MemoryRouter>
      <SeriesCard series={series} entry={entry} />
    </MemoryRouter>,
  );
}

describe("SeriesCard", () => {
  it("linka pro detalhe da série e mostra nome, ano, gênero e nota com uma casa decimal", () => {
    renderCard(BASE_SERIES);

    expect(screen.getByRole("link")).toHaveAttribute("href", "/series/1396");
    expect(screen.getByText("Breaking Bad")).toBeInTheDocument();
    expect(screen.getByText(/2008/)).toBeInTheDocument();
    expect(screen.getByText(/Drama/)).toBeInTheDocument();
    expect(screen.getByText(/\+1/)).toBeInTheDocument();
    expect(screen.getByText("8.9")).toBeInTheDocument();
  });

  it("lida com pôster, nota, gênero e data ausentes sem quebrar", () => {
    renderCard({
      ...BASE_SERIES,
      posterUrl: null,
      rating: null,
      genres: [],
      firstAirDate: null,
    });

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("Data desconhecida")).toBeInTheDocument();
  });

  it("mostra status, nota pessoal e selo de favorito quando há entry", () => {
    renderCard(BASE_SERIES, {
      id: "1",
      status: "completed",
      rating: 4.5,
      currentSeason: 5,
      currentEpisode: 16,
      favoriteSlot: 2,
      review: null,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(screen.getByText("Completo")).toBeInTheDocument();
    expect(screen.getByText("★ 4.5")).toBeInTheDocument();
    expect(screen.getByLabelText("Favoritado")).toBeInTheDocument();
  });

  it("reserva a linha de status/nota mesmo quando a entry não tem nenhum dos dois", () => {
    // Favoritar não define status nem nota — sem isso, esse card fica mais
    // baixo que os vizinhos que têm status/nota, quebrando o grid (bug real,
    // já corrigido pra jogos e replicado aqui de propósito).
    const { container } = renderCard(BASE_SERIES, {
      id: "1",
      status: null,
      rating: null,
      currentSeason: null,
      currentEpisode: null,
      favoriteSlot: 1,
      review: null,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(container.querySelector("p:last-child")).toBeEmptyDOMElement();
  });
});

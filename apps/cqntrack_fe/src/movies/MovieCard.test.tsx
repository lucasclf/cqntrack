import type { MovieEntry, MovieSummary } from "@cqntrack/shared";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { MovieCard } from "./MovieCard";

const BASE_MOVIE: MovieSummary = {
  tmdbId: 27205,
  name: "Inception",
  posterUrl: "https://image.tmdb.org/t/p/w342/edv5CZvWj09upOsy2Y6IwDhK8bt.jpg",
  releaseDate: "2010-07-15",
  genres: ["Action", "Science Fiction"],
  runtime: 148,
  rating: 8.368,
};

function renderCard(movie: MovieSummary, entry?: MovieEntry) {
  return render(
    <MemoryRouter>
      <MovieCard movie={movie} entry={entry} />
    </MemoryRouter>,
  );
}

describe("MovieCard", () => {
  it("linka pro detalhe do filme e mostra nome, ano, gênero e nota com uma casa decimal", () => {
    renderCard(BASE_MOVIE);

    expect(screen.getByRole("link")).toHaveAttribute("href", "/filmes/27205");
    expect(screen.getByText("Inception")).toBeInTheDocument();
    expect(screen.getByText(/2010/)).toBeInTheDocument();
    expect(screen.getByText(/Action/)).toBeInTheDocument();
    expect(screen.getByText(/\+1/)).toBeInTheDocument();
    expect(screen.getByText("8.4")).toBeInTheDocument();
  });

  it("lida com pôster, nota, gênero e data ausentes sem quebrar", () => {
    renderCard({
      ...BASE_MOVIE,
      posterUrl: null,
      rating: null,
      genres: [],
      releaseDate: null,
    });

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("Data desconhecida")).toBeInTheDocument();
  });

  it("mostra selo de status, nota pessoal e selo de favorito quando há entry", () => {
    renderCard(BASE_MOVIE, {
      id: "1",
      status: "watched",
      rating: 4.5,
      watchedAt: "2026-01-01T00:00:00.000Z",
      favoritedAt: "2026-01-01T00:00:00.000Z",
      review: null,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(screen.getByText("Já vi")).toBeInTheDocument();
    expect(screen.getByText("★ 4.5")).toBeInTheDocument();
    expect(screen.getByLabelText("Favoritado")).toBeInTheDocument();
  });

  it("reserva a linha de status/nota mesmo quando a entry não tem nenhum dos dois", () => {
    // Favoritar não marca status nem nota — sem isso, esse card fica mais
    // baixo que os vizinhos que têm status/nota, quebrando o grid (bug real,
    // já corrigido pra jogos e série e replicado aqui de propósito).
    const { container } = renderCard(BASE_MOVIE, {
      id: "1",
      status: null,
      rating: null,
      watchedAt: null,
      favoritedAt: "2026-01-01T00:00:00.000Z",
      review: null,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(container.querySelector("p:last-child")).toBeEmptyDOMElement();
  });
});

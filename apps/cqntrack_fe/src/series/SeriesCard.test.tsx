import type { SeriesEntry, SeriesSummary } from "@cqntrack/shared";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfirmDialogProvider } from "../lib/ConfirmDialogProvider";
import { SeriesCard } from "./SeriesCard";

const { putMock } = vi.hoisted(() => ({ putMock: vi.fn() }));

vi.mock("../lib/api-client", () => ({
  apiClient: { put: putMock },
}));

const BASE_SERIES: SeriesSummary = {
  tmdbId: 1396,
  name: "Breaking Bad",
  posterUrl: "https://image.tmdb.org/t/p/w342/anFx9aTOOYqgS3v7x3R84Kz67ly.jpg",
  firstAirDate: "2008-01-20",
  genres: ["Drama", "Crime"],
  numberOfSeasons: 5,
  numberOfEpisodes: 62,
  seasons: null,
  rating: 8.947,
};

function renderCard(series: SeriesSummary, entry?: SeriesEntry | null, interactive = false) {
  return render(
    <MemoryRouter>
      <SeriesCard series={series} entry={entry} interactive={interactive} />
    </MemoryRouter>,
  );
}

function renderInteractiveCard(series: SeriesSummary, entry?: SeriesEntry | null) {
  return render(
    <ConfirmDialogProvider>
      <MemoryRouter>
        <SeriesCard series={series} entry={entry} interactive />
      </MemoryRouter>
    </ConfirmDialogProvider>,
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

  it("mostra progresso de episódios, nota pessoal e selo de favorito quando há entry", () => {
    renderCard(BASE_SERIES, {
      id: "1",
      rating: 4.5,
      watchedEpisodeCount: 40,
      favoritedAt: "2026-01-01T00:00:00.000Z",
      abandonedAt: null,
      review: null,
      updatedAt: "2026-01-01T00:00:00.000Z",
      availableEpisode: null,
      upcomingEpisode: null,
    });

    expect(screen.getByText("40/62 ep.")).toBeInTheDocument();
    expect(screen.getByText("★ 4.5")).toBeInTheDocument();
    expect(screen.getByLabelText("Favoritado")).toBeInTheDocument();
  });

  it("reserva a linha de progresso/nota mesmo quando a entry não tem nenhum dos dois", () => {
    // Favoritar não marca episódio nem nota — sem isso, esse card fica mais
    // baixo que os vizinhos que têm progresso/nota, quebrando o grid (bug
    // real, já corrigido pra jogos e replicado aqui de propósito).
    const { container } = renderCard(BASE_SERIES, {
      id: "1",
      rating: null,
      watchedEpisodeCount: 0,
      favoritedAt: "2026-01-01T00:00:00.000Z",
      abandonedAt: null,
      review: null,
      updatedAt: "2026-01-01T00:00:00.000Z",
      availableEpisode: null,
      upcomingEpisode: null,
    });

    expect(container.querySelector("p:last-child")).toBeEmptyDOMElement();
  });

  it("mostra o selo de episódio novo quando a entry tem availableEpisode", () => {
    renderCard(BASE_SERIES, {
      id: "1",
      rating: null,
      watchedEpisodeCount: 40,
      favoritedAt: null,
      abandonedAt: null,
      review: null,
      updatedAt: "2026-01-01T00:00:00.000Z",
      availableEpisode: {
        seasonNumber: 5,
        episodeNumber: 15,
        name: "Granite State",
        airDate: "2013-09-22",
      },
      upcomingEpisode: null,
    });

    expect(screen.getByText("Novo episódio")).toBeInTheDocument();
  });

  it("mostra o selo de previsão quando só há upcomingEpisode (sem availableEpisode)", () => {
    renderCard(BASE_SERIES, {
      id: "1",
      rating: null,
      watchedEpisodeCount: 40,
      favoritedAt: null,
      abandonedAt: null,
      review: null,
      updatedAt: "2026-01-01T00:00:00.000Z",
      availableEpisode: null,
      upcomingEpisode: {
        seasonNumber: 5,
        episodeNumber: 16,
        name: "Felina",
        airDate: "2026-12-25",
      },
    });

    expect(screen.getByText("Previsto 25/12")).toBeInTheDocument();
    expect(screen.queryByText("Novo episódio")).not.toBeInTheDocument();
  });

  it("sem interactive, não renderiza os botões de ação rápida", () => {
    renderCard(BASE_SERIES);

    expect(screen.queryByLabelText("Favoritar")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Marcar série inteira como assistida")).not.toBeInTheDocument();
  });

  describe("interactive", () => {
    beforeEach(() => {
      putMock.mockReset();
    });

    it("favoritar chama o PUT e atualiza otimista, sem navegar", () => {
      putMock.mockResolvedValue({});
      renderInteractiveCard(BASE_SERIES, null);

      fireEvent.click(screen.getByLabelText("Favoritar"));

      expect(putMock).toHaveBeenCalledWith("/api/series/1396/entry", { favorited: true });
      expect(screen.getByLabelText("Desfavoritar")).toBeInTheDocument();
    });

    it("marcar a série inteira pede confirmação e chama o PUT watch-all", async () => {
      putMock.mockResolvedValue(undefined);
      renderInteractiveCard(BASE_SERIES, null);

      fireEvent.click(screen.getByLabelText("Marcar série inteira como assistida"));
      expect(
        await screen.findByText("Marcar todas as temporadas desta série como assistidas?"),
      ).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

      await waitFor(() => expect(putMock).toHaveBeenCalledWith("/api/series/1396/watch-all"));
      expect(await screen.findByText("62/62 ep.")).toBeInTheDocument();
    });

    it("cancelando a confirmação, não chama o PUT watch-all", async () => {
      renderInteractiveCard(BASE_SERIES, null);

      fireEvent.click(screen.getByLabelText("Marcar série inteira como assistida"));
      fireEvent.click(await screen.findByRole("button", { name: "Cancelar" }));

      expect(putMock).not.toHaveBeenCalledWith("/api/series/1396/watch-all");
    });

    it("o clique nos botões não navega pro detalhe (preventDefault)", () => {
      putMock.mockResolvedValue({});
      renderInteractiveCard(BASE_SERIES, null);

      const clickEvent = new MouseEvent("click", { bubbles: true, cancelable: true });
      const preventDefaultSpy = vi.spyOn(clickEvent, "preventDefault");
      screen.getByLabelText("Favoritar").dispatchEvent(clickEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });
});

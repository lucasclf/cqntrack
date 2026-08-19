import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Home } from "./Home";

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock("./lib/api-client", () => ({
  apiClient: { get: getMock },
}));

const EMPTY_FAVORITES = { items: [] };
const EMPTY_ENTRIES = { items: [], page: 1, pageSize: 24, total: 0 };
const EMPTY_ACTIVITY = { items: [], nextCursor: null };
const EMPTY_CONTINUE_WATCHING = { items: [] };

const MOVIE = {
  tmdbId: 27205,
  name: "Inception",
  posterUrl: null,
  releaseDate: "2010-07-15",
  genres: [],
  runtime: null,
  rating: null,
};

const SERIES = {
  tmdbId: 1399,
  name: "Game of Thrones",
  posterUrl: null,
  firstAirDate: "2011-04-17",
  genres: [],
  numberOfSeasons: 8,
  numberOfEpisodes: 73,
  seasons: null,
  rating: null,
};

function renderHome() {
  render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>,
  );
}

// Mock genérico cobrindo tudo que a Home carrega de cara (continuar
// assistindo + atividades + as 3 abas secundárias, todas com "/api" em vez
// de "/api/users/:username") — cada rota devolve vazio por padrão. Testes
// que precisam de dado real sobrescrevem a rota específica.
function mockHomeEmpty(overrides: Record<string, unknown> = {}) {
  getMock.mockImplementation((path: string) => {
    if (path in overrides) return Promise.resolve(overrides[path]);
    if (path === "/api/series/continue-watching") return Promise.resolve(EMPTY_CONTINUE_WATCHING);
    if (path === "/api/movies/favorites") return Promise.resolve(EMPTY_FAVORITES);
    if (path === "/api/books/favorites") return Promise.resolve(EMPTY_FAVORITES);
    if (path === "/api/games/favorites") return Promise.resolve(EMPTY_FAVORITES);
    if (path.startsWith("/api/movies/entries")) return Promise.resolve(EMPTY_ENTRIES);
    if (path.startsWith("/api/books/entries")) return Promise.resolve(EMPTY_ENTRIES);
    if (path.startsWith("/api/games/entries")) return Promise.resolve(EMPTY_ENTRIES);
    if (path.startsWith("/api/activity")) return Promise.resolve(EMPTY_ACTIVITY);
    return Promise.reject(new Error("rota inesperada: " + path));
  });
}

describe("Home", () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it("mostra o título, continuar assistindo, atividades e as 3 abas secundárias (Filmes/Jogos/Livros)", async () => {
    mockHomeEmpty();
    renderHome();

    expect(screen.getByRole("heading", { name: "cqntrack" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Continuar assistindo" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Atividades recentes" })).toBeInTheDocument();
    expect(await screen.findByText("Nenhum episódio pendente — tudo em dia!")).toBeInTheDocument();

    // "Filmes"/"Jogos" são ambíguos com os botões de filtro de
    // ActivityTab (mesmo rótulo) — escopa pro nav das abas de mídia.
    const mediaTabs = screen.getByRole("navigation", { name: "Mídia" });
    expect(within(mediaTabs).getByRole("button", { name: "Filmes" })).toBeInTheDocument();
    expect(within(mediaTabs).getByRole("button", { name: "Jogos" })).toBeInTheDocument();
    expect(within(mediaTabs).getByRole("button", { name: "Livros" })).toBeInTheDocument();
    expect(within(mediaTabs).queryByRole("button", { name: "Séries" })).not.toBeInTheDocument();
    expect(within(mediaTabs).queryByRole("button", { name: "Atividades" })).not.toBeInTheDocument();

    // Aba padrão da seção secundária é Filmes.
    expect(within(mediaTabs).getByRole("button", { name: "Filmes" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("continuar assistindo lista a série com o próximo episódio, linkando pro episódio", async () => {
    mockHomeEmpty({
      "/api/series/continue-watching": {
        items: [
          {
            series: SERIES,
            nextEpisode: {
              seasonNumber: 2,
              episodeNumber: 3,
              name: "What Is Dead May Never Die",
              airDate: "2012-04-15",
            },
            recentlyActive: true,
          },
        ],
      },
    });
    renderHome();

    expect(await screen.findByText("Game of Thrones")).toBeInTheDocument();
    expect(
      screen.getByText("Temporada 2 · Episódio 3 — What Is Dead May Never Die"),
    ).toBeInTheDocument();
    expect(screen.getByText("Lançado em 15/04/2012")).toBeInTheDocument();

    const link = screen.getByRole("link", { name: /Game of Thrones/ });
    expect(link).toHaveAttribute("href", "/series/1399/temporadas/2/episodios/3");
  });

  it("aba Filmes (seção secundária) mostra favoritos + assistido recentemente + estatísticas, com dado próprio", async () => {
    mockHomeEmpty({
      "/api/movies/favorites": {
        items: [
          {
            id: "1",
            status: "watched",
            rating: null,
            watchedAt: "2026-01-01T00:00:00.000Z",
            favoritedAt: "2026-01-01T00:00:00.000Z",
            review: null,
            updatedAt: "2026-01-01T00:00:00.000Z",
            movie: MOVIE,
          },
        ],
      },
    });
    renderHome();

    expect(await screen.findByRole("heading", { name: "Filmes favoritos" })).toBeInTheDocument();
    expect(screen.getAllByText("Inception")).not.toHaveLength(0);

    // Estatística clicável leva pra tela real de marcações, filtrando por
    // status via query string (ver MyMovieEntries). Escopado pra dentro da
    // lateral: o card do filme favoritado também tem "Já vi" no seu nome
    // acessível (pill de status), então uma busca sem escopo bateria nos
    // dois.
    const sidebar = screen.getByRole("complementary");
    const link = await within(sidebar).findByRole("link", { name: /Já vi/ });
    expect(link).toHaveAttribute("href", "/filmes/marcacoes?status=watched");
  });

  it("atividades recentes mostra o feed com filtro por mídia", async () => {
    mockHomeEmpty();
    renderHome();

    const filterGroup = await screen.findByRole("group", { name: "Filtrar por mídia" });
    expect(within(filterGroup).getByRole("button", { name: "Todas" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(await screen.findByText("Nenhuma atividade por aqui ainda.")).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledWith("/api/activity");

    fireEvent.click(within(filterGroup).getByRole("button", { name: "Jogos" }));
    expect(await screen.findByText("Nenhuma atividade por aqui ainda.")).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledWith("/api/activity?mediaType=games");
  });

  it("aba Jogos (seção secundária) mostra a estatística, levando pra marcações", async () => {
    mockHomeEmpty();
    renderHome();

    const mediaTabs = screen.getByRole("navigation", { name: "Mídia" });
    fireEvent.click(within(mediaTabs).getByRole("button", { name: "Jogos" }));

    const sidebar = screen.getByRole("complementary");
    const link = await within(sidebar).findByRole("link", { name: /Jogando/ });
    expect(link).toHaveAttribute("href", "/jogos/marcacoes?status=playing");
  });
});

import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Home } from "./Home";

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock("./lib/api-client", () => ({
  apiClient: { get: getMock },
}));

const EMPTY_PAGINATED = { items: [], page: 1, pageSize: 12, total: 0 };
const EMPTY_ACTIVITY = { items: [], nextCursor: null };
const EMPTY_CONTINUE_WATCHING = { items: [], nextCursor: null };
const EMPTY_RECENTLY_WATCHED_SERIES = { items: [], page: 1, pageSize: 12, total: 0 };

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

function homeTabsNav() {
  return screen.getByRole("navigation", { name: "Seções da home" });
}

// Mock genérico cobrindo tudo que a Home carrega de cara (as 6 abas, todas
// com "/api" em vez de "/api/users/:username") — cada rota devolve vazio
// por padrão. Testes que precisam de dado real sobrescrevem a rota
// específica (query string exata, ver *CategoryPanel.tsx).
function mockHomeEmpty(overrides: Record<string, unknown> = {}) {
  getMock.mockImplementation((path: string) => {
    if (path in overrides) return Promise.resolve(overrides[path]);
    if (path === "/api/series/continue-watching") return Promise.resolve(EMPTY_CONTINUE_WATCHING);
    if (path.startsWith("/api/series/recently-watched")) {
      return Promise.resolve(EMPTY_RECENTLY_WATCHED_SERIES);
    }
    if (path.startsWith("/api/movies/entries")) return Promise.resolve(EMPTY_PAGINATED);
    if (path.startsWith("/api/series/entries")) return Promise.resolve(EMPTY_PAGINATED);
    if (path.startsWith("/api/games/entries")) return Promise.resolve(EMPTY_PAGINATED);
    if (path.startsWith("/api/books/entries")) return Promise.resolve(EMPTY_PAGINATED);
    if (path.startsWith("/api/activity")) return Promise.resolve(EMPTY_ACTIVITY);
    return Promise.reject(new Error("rota inesperada: " + path));
  });
}

describe("Home", () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it("mostra as 6 abas, com Continuar assistindo ativa por padrão", async () => {
    mockHomeEmpty();
    renderHome();

    // Sem <h1> aqui — "cqntrack" já aparece no header (TopBar), fora do
    // que esse componente renderiza isoladamente.
    expect(screen.queryByRole("heading", { name: "cqntrack" })).not.toBeInTheDocument();

    const nav = homeTabsNav();
    for (const label of [
      "Continuar assistindo",
      "Séries",
      "Filmes",
      "Jogos",
      "Livros",
      "Atividades recentes",
    ]) {
      expect(within(nav).getByRole("button", { name: label })).toBeInTheDocument();
    }
    expect(within(nav).getByRole("button", { name: "Continuar assistindo" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    expect(await screen.findByText("Nenhum episódio pendente — tudo em dia!")).toBeVisible();
  });

  it("carrega o conteúdo de todas as abas ao montar; trocar de aba só alterna visibilidade, sem refazer fetch", async () => {
    const favoritesUrl =
      "/api/movies/entries?favorite=true&sortBy=favorite&order=desc&page=1&pageSize=12";
    mockHomeEmpty({
      [favoritesUrl]: {
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
        page: 1,
        pageSize: 12,
        total: 1,
      },
    });
    renderHome();

    // Espera a aba ativa (Continuar assistindo) assentar — garante que os
    // efeitos de montagem das outras abas, disparados no mesmo render,
    // também já rodaram.
    await screen.findByText("Nenhum episódio pendente — tudo em dia!");

    expect(getMock).toHaveBeenCalledWith(favoritesUrl);
    expect(getMock).toHaveBeenCalledWith("/api/activity");
    expect(getMock.mock.calls.filter(([path]) => path === favoritesUrl)).toHaveLength(1);

    // Já buscado, mas escondido — a aba ativa ainda é "Continuar assistindo".
    expect(screen.getByText("Inception")).not.toBeVisible();

    fireEvent.click(within(homeTabsNav()).getByRole("button", { name: "Filmes" }));

    expect(await screen.findByText("Inception")).toBeVisible();
    // Mesmo depois de trocar de aba, nenhum novo fetch — o dado já estava
    // carregado desde a montagem.
    expect(getMock.mock.calls.filter(([path]) => path === favoritesUrl)).toHaveLength(1);
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
        nextCursor: null,
      },
    });
    renderHome();

    expect(await screen.findByText("Game of Thrones")).toBeVisible();
    expect(
      screen.getByText("Temporada 2 · Episódio 3 — What Is Dead May Never Die"),
    ).toBeInTheDocument();
    expect(screen.getByText("Lançado em 15/04/2012")).toBeInTheDocument();

    const link = screen.getByRole("link", { name: /Game of Thrones/ });
    expect(link).toHaveAttribute("href", "/series/1399?temporada=2");
  });

  it("aba Séries mostra favoritos + estatísticas, com dado próprio", async () => {
    mockHomeEmpty({
      "/api/series/entries?favorite=true&sortBy=favorite&order=desc&page=1&pageSize=12": {
        items: [
          {
            id: "1",
            rating: null,
            watchedEpisodeCount: 12,
            favoritedAt: "2026-01-01T00:00:00.000Z",
            abandonedAt: null,
            review: null,
            updatedAt: "2026-01-01T00:00:00.000Z",
            availableEpisode: null,
            upcomingEpisode: null,
            series: SERIES,
          },
        ],
        page: 1,
        pageSize: 12,
        total: 1,
      },
      "/api/series/recently-watched?page=1&pageSize=1": {
        items: [],
        page: 1,
        pageSize: 1,
        total: 3,
      },
    });
    renderHome();

    fireEvent.click(within(homeTabsNav()).getByRole("button", { name: "Séries" }));

    expect(await screen.findByText("Game of Thrones")).toBeInTheDocument();

    const sidebar = screen.getByRole("complementary");
    const link = await within(sidebar).findByRole("link", { name: /Séries acompanhadas/ });
    expect(link).toHaveAttribute("href", "/series/marcacoes");
  });

  it("aba Filmes mostra favoritos + assistido recentemente + estatísticas, com dado próprio", async () => {
    mockHomeEmpty({
      "/api/movies/entries?favorite=true&sortBy=favorite&order=desc&page=1&pageSize=12": {
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
        page: 1,
        pageSize: 12,
        total: 1,
      },
    });
    renderHome();

    fireEvent.click(within(homeTabsNav()).getByRole("button", { name: "Filmes" }));

    expect(await screen.findByText("Inception")).toBeInTheDocument();

    // Estatística clicável leva pra tela real de marcações, filtrando por
    // status via query string (ver MyMovieEntries). Escopado pra dentro da
    // lateral: o card do filme favoritado também tem "Já vi" no seu nome
    // acessível (pill de status), então uma busca sem escopo bateria nos
    // dois.
    const sidebar = screen.getByRole("complementary");
    const link = await within(sidebar).findByRole("link", { name: /Já vi/ });
    expect(link).toHaveAttribute("href", "/filmes/marcacoes?status=watched");
  });

  it("aba Atividades recentes mostra o feed com filtro por mídia", async () => {
    mockHomeEmpty();
    renderHome();

    fireEvent.click(within(homeTabsNav()).getByRole("button", { name: "Atividades recentes" }));

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

  it("aba Jogos mostra a estatística, levando pra marcações", async () => {
    mockHomeEmpty();
    renderHome();

    fireEvent.click(within(homeTabsNav()).getByRole("button", { name: "Jogos" }));

    const sidebar = screen.getByRole("complementary");
    const link = await within(sidebar).findByRole("link", { name: /Jogando/ });
    expect(link).toHaveAttribute("href", "/jogos/marcacoes?status=playing");
  });

  it("categorias vazias mostram mensagem de que não há itens, tanto em favoritos quanto em recentes", async () => {
    mockHomeEmpty();
    renderHome();

    const nav = homeTabsNav();
    const categories = [
      {
        tab: "Séries",
        recentLabel: "Assistido recentemente",
        favMsg: "Nenhuma série favoritada ainda.",
        recentMsg: "Nenhuma série assistida recentemente.",
      },
      {
        tab: "Filmes",
        recentLabel: "Assistido recentemente",
        favMsg: "Nenhum filme favoritado ainda.",
        recentMsg: "Nenhum filme assistido recentemente.",
      },
      {
        tab: "Jogos",
        recentLabel: "Jogado recentemente",
        favMsg: "Nenhum jogo favoritado ainda.",
        recentMsg: "Nenhum jogo jogado recentemente.",
      },
      {
        tab: "Livros",
        recentLabel: "Lido recentemente",
        favMsg: "Nenhum livro favoritado ainda.",
        recentMsg: "Nenhum livro lido recentemente.",
      },
    ];

    for (const category of categories) {
      fireEvent.click(within(nav).getByRole("button", { name: category.tab }));
      expect(await screen.findByText(category.favMsg)).toBeVisible();

      fireEvent.click(screen.getByRole("tab", { name: category.recentLabel }));
      expect(await screen.findByText(category.recentMsg)).toBeVisible();
    }
  });
});

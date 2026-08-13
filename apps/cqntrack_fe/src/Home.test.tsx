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
const EMPTY_RECENTLY_WATCHED_SERIES = { items: [], page: 1, pageSize: 1, total: 0 };

const MOVIE = {
  tmdbId: 27205,
  name: "Inception",
  posterUrl: null,
  releaseDate: "2010-07-15",
  genres: [],
  runtime: null,
  rating: null,
};

function renderHome() {
  render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>,
  );
}

// Mock genérico que cobre as 8 rotas usadas pelas abas (favoritos + recente
// x4 mídias, todas com "/api" em vez de "/api/users/:username") — sem
// mediaType específico, cada rota devolve vazio por padrão. Testes que
// precisam de dado real sobrescrevem a rota específica.
function mockAllTabsEmpty(overrides: Record<string, unknown> = {}) {
  getMock.mockImplementation((path: string) => {
    if (path in overrides) return Promise.resolve(overrides[path]);
    if (path === "/api/movies/favorites") return Promise.resolve(EMPTY_FAVORITES);
    if (path === "/api/series/favorites") return Promise.resolve(EMPTY_FAVORITES);
    if (path === "/api/books/favorites") return Promise.resolve(EMPTY_FAVORITES);
    if (path === "/api/games/favorites") return Promise.resolve(EMPTY_FAVORITES);
    if (path.startsWith("/api/movies/entries")) return Promise.resolve(EMPTY_ENTRIES);
    if (path.startsWith("/api/series/recently-watched")) {
      return Promise.resolve(EMPTY_RECENTLY_WATCHED_SERIES);
    }
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

  it("mostra o título e as 5 abas (Filmes/Séries/Jogos/Livros/Atividades)", () => {
    mockAllTabsEmpty();
    renderHome();

    expect(screen.getByRole("heading", { name: "cqntrack" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Filmes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Séries" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Jogos" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Livros" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Atividades" })).toBeInTheDocument();

    // Aba padrão é Filmes.
    expect(screen.getByRole("button", { name: "Filmes" })).toHaveAttribute("aria-current", "page");
  });

  it("aba Filmes mostra favoritos + assistido recentemente + estatísticas, com dado próprio (sem username na URL)", async () => {
    mockAllTabsEmpty({
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

  it("clicar na aba Atividades mostra o feed com filtro por mídia", async () => {
    mockAllTabsEmpty();
    renderHome();

    fireEvent.click(screen.getByRole("button", { name: "Atividades" }));

    const filterGroup = screen.getByRole("group", { name: "Filtrar por mídia" });
    expect(within(filterGroup).getByRole("button", { name: "Todas" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(await screen.findByText("Nenhuma atividade por aqui ainda.")).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledWith("/api/activity");

    // "Jogos" é ambíguo com a aba de mídia (HomeTabs) — escopa pro grupo de
    // filtro.
    fireEvent.click(within(filterGroup).getByRole("button", { name: "Jogos" }));
    expect(await screen.findByText("Nenhuma atividade por aqui ainda.")).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledWith("/api/activity?mediaType=games");
  });

  it("aba Séries mostra a estatística agregada (sem status), levando pra marcações", async () => {
    mockAllTabsEmpty({
      "/api/series/recently-watched?page=1&pageSize=1": {
        items: [],
        page: 1,
        pageSize: 1,
        total: 3,
      },
    });
    renderHome();

    fireEvent.click(screen.getByRole("button", { name: "Séries" }));

    const sidebar = screen.getByRole("complementary");
    const link = await within(sidebar).findByRole("link", { name: /Séries acompanhadas/ });
    expect(link).toHaveAttribute("href", "/series/marcacoes");
  });
});

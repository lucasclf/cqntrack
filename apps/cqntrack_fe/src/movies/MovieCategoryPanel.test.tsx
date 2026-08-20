import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MovieCategoryPanel } from "./MovieCategoryPanel";

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock("../lib/api-client", () => ({
  apiClient: { get: getMock },
}));

function movieEntry(id: number, title: string) {
  return {
    id: String(id),
    status: "watched",
    rating: null,
    watchedAt: "2026-01-01T00:00:00.000Z",
    favoritedAt: "2026-01-01T00:00:00.000Z",
    review: null,
    updatedAt: "2026-01-01T00:00:00.000Z",
    movie: {
      tmdbId: id,
      name: title,
      posterUrl: null,
      releaseDate: "2010-01-01",
      genres: [],
      runtime: null,
      rating: null,
    },
  };
}

function paginated(items: unknown[], page: number, total: number) {
  return { items, page, pageSize: 2, total };
}

let observerInstances: MockIntersectionObserver[] = [];

class MockIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "";
  readonly thresholds: ReadonlyArray<number> = [];
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = (): IntersectionObserverEntry[] => [];
  constructor(public callback: IntersectionObserverCallback) {
    observerInstances.push(this);
  }
}

function intersectLastSentinel() {
  const instance = observerInstances.at(-1);
  instance?.callback([{ isIntersecting: true } as IntersectionObserverEntry], instance);
}

function renderPanel() {
  render(
    <MemoryRouter>
      <MovieCategoryPanel basePath="/api" />
    </MemoryRouter>,
  );
}

const FAVORITES_PAGE1_URL =
  "/api/movies/entries?favorite=true&sortBy=favorite&order=desc&page=1&pageSize=12";
const FAVORITES_PAGE2_URL =
  "/api/movies/entries?favorite=true&sortBy=favorite&order=desc&page=2&pageSize=12";
const RECENT_PAGE1_URL =
  "/api/movies/entries?status=watched&sortBy=updatedAt&order=desc&page=1&pageSize=12";

describe("MovieCategoryPanel", () => {
  beforeEach(() => {
    getMock.mockReset();
    observerInstances = [];
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });

  it("carrega favoritos e recentes desde a montagem; a sub-aba inativa fica escondida, não refaz fetch ao voltar", async () => {
    getMock.mockImplementation((path: string) => {
      if (path === FAVORITES_PAGE1_URL) {
        return Promise.resolve(paginated([movieEntry(1, "Favorito 1")], 1, 1));
      }
      if (path === RECENT_PAGE1_URL) {
        return Promise.resolve(paginated([movieEntry(2, "Recente 1")], 1, 1));
      }
      return Promise.reject(new Error("rota inesperada: " + path));
    });

    renderPanel();

    expect(await screen.findByText("Favorito 1")).toBeVisible();
    expect(getMock).toHaveBeenCalledWith(RECENT_PAGE1_URL);
    // Já buscado (carrega tudo de cara), mas escondido — sub-aba ativa é Favoritos.
    expect(screen.getByText("Recente 1")).not.toBeVisible();

    fireEvent.click(screen.getByRole("tab", { name: "Assistido recentemente" }));
    expect(await screen.findByText("Recente 1")).toBeVisible();
    expect(screen.getByText("Favorito 1")).not.toBeVisible();

    fireEvent.click(screen.getByRole("tab", { name: "Favoritos" }));
    expect(await screen.findByText("Favorito 1")).toBeVisible();
    // Nenhum fetch novo em nenhuma das trocas.
    expect(getMock.mock.calls.filter(([path]) => path === FAVORITES_PAGE1_URL)).toHaveLength(1);
    expect(getMock.mock.calls.filter(([path]) => path === RECENT_PAGE1_URL)).toHaveLength(1);
  });

  it("rolagem infinita: sentinela entrando na viewport carrega a próxima página e acumula, sem duplicar", async () => {
    getMock.mockImplementation((path: string) => {
      if (path === FAVORITES_PAGE1_URL) {
        return Promise.resolve(
          paginated([movieEntry(1, "Favorito 1"), movieEntry(2, "Favorito 2")], 1, 3),
        );
      }
      if (path === FAVORITES_PAGE2_URL) {
        return Promise.resolve(paginated([movieEntry(3, "Favorito 3")], 2, 3));
      }
      if (path === RECENT_PAGE1_URL) {
        return Promise.resolve(paginated([], 1, 0));
      }
      return Promise.reject(new Error("rota inesperada: " + path));
    });

    renderPanel();

    expect(await screen.findByText("Favorito 1")).toBeVisible();
    expect(screen.getByText("Favorito 2")).toBeVisible();
    expect(screen.queryByText("Favorito 3")).not.toBeInTheDocument();

    await act(async () => {
      intersectLastSentinel();
    });

    expect(await screen.findByText("Favorito 3")).toBeVisible();
    expect(screen.getByText("Favorito 1")).toBeVisible();
    expect(screen.getByText("Favorito 2")).toBeVisible();
    expect(getMock.mock.calls.filter(([path]) => path === FAVORITES_PAGE2_URL)).toHaveLength(1);
  });

  it("categoria vazia mostra mensagem, não uma lista em branco", async () => {
    getMock.mockResolvedValue(paginated([], 1, 0));
    renderPanel();

    expect(await screen.findByText("Nenhum filme favoritado ainda.")).toBeVisible();

    fireEvent.click(screen.getByRole("tab", { name: "Assistido recentemente" }));
    expect(await screen.findByText("Nenhum filme assistido recentemente.")).toBeVisible();
  });
});

import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContinueWatching } from "./ContinueWatching";

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock("../lib/api-client", () => ({
  apiClient: { get: getMock },
}));

const SERIES_A = {
  tmdbId: 1,
  name: "Série A",
  posterUrl: null,
  firstAirDate: "2020-01-01",
  genres: [],
  numberOfSeasons: 1,
  numberOfEpisodes: 10,
  seasons: null,
  rating: null,
};

const SERIES_B = {
  tmdbId: 2,
  name: "Série B",
  posterUrl: null,
  firstAirDate: "2020-01-01",
  genres: [],
  numberOfSeasons: 1,
  numberOfEpisodes: 10,
  seasons: null,
  rating: null,
};

function nextEpisodeOf(seriesId: number) {
  return { seasonNumber: 1, episodeNumber: 1, name: `Ep. ${seriesId}`, airDate: "2020-01-01" };
}

function renderContinueWatching() {
  render(
    <MemoryRouter>
      <ContinueWatching />
    </MemoryRouter>,
  );
}

// Captura a instância criada por useInfiniteScrollSentinel — o stub global
// em setupTests.ts já cobre "não quebra ao montar", aqui é preciso simular
// de verdade "sentinela entrou na viewport" pra testar o carregamento da
// próxima página.
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

function intersectSentinel() {
  const instance = observerInstances.at(-1);
  instance?.callback([{ isIntersecting: true } as IntersectionObserverEntry], instance);
}

describe("ContinueWatching", () => {
  beforeEach(() => {
    getMock.mockReset();
    observerInstances = [];
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });

  it("carrega a próxima página ao entrar na viewport, sem duplicar, e some o sentinela no fim", async () => {
    getMock.mockImplementation((path: string) => {
      if (path === "/api/series/continue-watching") {
        return Promise.resolve({
          items: [{ series: SERIES_A, nextEpisode: nextEpisodeOf(1), recentlyActive: false }],
          nextCursor: 1,
        });
      }
      if (path === "/api/series/continue-watching?cursor=1") {
        return Promise.resolve({
          items: [{ series: SERIES_B, nextEpisode: nextEpisodeOf(2), recentlyActive: false }],
          nextCursor: null,
        });
      }
      return Promise.reject(new Error("rota inesperada: " + path));
    });

    renderContinueWatching();

    expect(await screen.findByText("Série A")).toBeInTheDocument();
    expect(screen.queryByText("Série B")).not.toBeInTheDocument();

    await act(async () => {
      intersectSentinel();
    });

    expect(await screen.findByText("Série B")).toBeInTheDocument();
    // As duas ficam na lista (acumula, não substitui).
    expect(screen.getByText("Série A")).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledTimes(2);

    // nextCursor null na 2ª página — sem mais sentinela pra observar, uma
    // 3ª chamada não deveria acontecer mesmo insistindo.
    await act(async () => {
      intersectSentinel();
    });
    expect(getMock).toHaveBeenCalledTimes(2);
  });

  it("não mostra sentinela quando a primeira página já não tem mais nada", async () => {
    getMock.mockResolvedValue({
      items: [{ series: SERIES_A, nextEpisode: nextEpisodeOf(1), recentlyActive: false }],
      nextCursor: null,
    });

    renderContinueWatching();

    expect(await screen.findByText("Série A")).toBeInTheDocument();
    expect(observerInstances).toHaveLength(0);
  });
});

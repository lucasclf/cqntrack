import type { SeriesSeasonSummary } from "@cqntrack/shared";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SeriesEpisodeList } from "./SeriesEpisodeList";

function renderList(
  props: Omit<ComponentProps<typeof SeriesEpisodeList>, "abandoned" | "onResume"> &
    Partial<Pick<ComponentProps<typeof SeriesEpisodeList>, "abandoned" | "onResume">>,
) {
  return render(
    <MemoryRouter>
      <SeriesEpisodeList abandoned={false} onResume={vi.fn()} {...props} />
    </MemoryRouter>,
  );
}

const { getMock, putMock } = vi.hoisted(() => ({ getMock: vi.fn(), putMock: vi.fn() }));

vi.mock("../lib/api-client", () => ({
  apiClient: { get: getMock, put: putMock },
}));

const SEASONS: SeriesSeasonSummary[] = [
  { seasonNumber: 1, name: "Temporada 1", episodeCount: 2, airDate: "2008-01-20", posterUrl: null },
  { seasonNumber: 2, name: "Temporada 2", episodeCount: 1, airDate: "2009-03-08", posterUrl: null },
];

function season1Response(allWatched = false) {
  return {
    seasonNumber: 1,
    episodes: [
      {
        episodeNumber: 1,
        name: "Pilot",
        airDate: "2008-01-20",
        stillUrl: "https://image.tmdb.org/t/p/w185/still-1.jpg",
        watched: allWatched,
      },
      {
        episodeNumber: 2,
        name: "Cat's in the Bag...",
        airDate: "2008-01-27",
        stillUrl: null,
        watched: allWatched,
      },
    ],
  };
}

function season2Response() {
  return {
    seasonNumber: 2,
    episodes: [
      { episodeNumber: 1, name: "Grilled", airDate: "2009-03-08", stillUrl: null, watched: false },
    ],
  };
}

describe("SeriesEpisodeList", () => {
  beforeEach(() => {
    getMock.mockReset();
    putMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("abre na Temporada 1 e lista os episódios", async () => {
    getMock.mockResolvedValue(season1Response());
    renderList({ tmdbId: 1396, seasons: SEASONS });

    expect(await screen.findByText("1. Pilot")).toBeInTheDocument();
    expect(screen.getByText("2. Cat's in the Bag...")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Temporada 1" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(getMock).toHaveBeenCalledWith("/api/series/1396/seasons/1");
  });

  it("com initialSeasonNumber, abre direto naquela temporada em vez da 1", async () => {
    getMock.mockImplementation((path: string) => {
      if (path === "/api/series/1396/seasons/2") return Promise.resolve(season2Response());
      return Promise.reject(new Error("rota inesperada: " + path));
    });
    renderList({ tmdbId: 1396, seasons: SEASONS, initialSeasonNumber: 2 });

    expect(await screen.findByText("1. Grilled")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Temporada 2" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(getMock).not.toHaveBeenCalledWith("/api/series/1396/seasons/1");
  });

  it("initialSeasonNumber que não existe na série cai no padrão (Temporada 1)", async () => {
    getMock.mockResolvedValue(season1Response());
    renderList({ tmdbId: 1396, seasons: SEASONS, initialSeasonNumber: 99 });

    expect(await screen.findByText("1. Pilot")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Temporada 1" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("com initialSeasonData da Temporada 1, renderiza direto sem buscar nem 'carregando'", () => {
    renderList({ tmdbId: 1396, seasons: SEASONS, initialSeasonData: season1Response() });

    expect(screen.getByText("1. Pilot")).toBeInTheDocument();
    expect(screen.queryByText("Carregando episódios...")).not.toBeInTheDocument();
    expect(getMock).not.toHaveBeenCalled();
  });

  it("troca de temporada ao clicar na aba", async () => {
    getMock.mockImplementation((path: string) => {
      if (path === "/api/series/1396/seasons/1") return Promise.resolve(season1Response());
      if (path === "/api/series/1396/seasons/2") return Promise.resolve(season2Response());
      return Promise.reject(new Error("rota inesperada: " + path));
    });
    renderList({ tmdbId: 1396, seasons: SEASONS });
    await screen.findByText("1. Pilot");

    fireEvent.click(screen.getByRole("tab", { name: "Temporada 2" }));

    expect(await screen.findByText("1. Grilled")).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledWith("/api/series/1396/seasons/2");
  });

  it("voltar pra uma temporada já vista é instantâneo, sem refazer o GET", async () => {
    getMock.mockImplementation((path: string) => {
      if (path === "/api/series/1396/seasons/1") return Promise.resolve(season1Response());
      if (path === "/api/series/1396/seasons/2") return Promise.resolve(season2Response());
      return Promise.reject(new Error("rota inesperada: " + path));
    });
    renderList({ tmdbId: 1396, seasons: SEASONS });
    await screen.findByText("1. Pilot");

    fireEvent.click(screen.getByRole("tab", { name: "Temporada 2" }));
    await screen.findByText("1. Grilled");
    getMock.mockClear();

    fireEvent.click(screen.getByRole("tab", { name: "Temporada 1" }));

    expect(await screen.findByText("1. Pilot")).toBeInTheDocument();
    expect(getMock).not.toHaveBeenCalled();
  });

  it("marca um episódio (otimista) e chama o PUT", async () => {
    getMock.mockResolvedValue(season1Response());
    putMock.mockResolvedValue(undefined);
    renderList({ tmdbId: 1396, seasons: SEASONS });
    await screen.findByText("1. Pilot");

    fireEvent.click(screen.getAllByLabelText("Assistido")[0]!);

    expect(putMock).toHaveBeenCalledWith("/api/series/1396/episodes/1/1", { watched: true });
    expect(screen.getAllByLabelText("Assistido")[0]).toBeChecked();
  });

  it("reverte a marcação e mostra erro quando o PUT falha", async () => {
    getMock.mockResolvedValue(season1Response());
    putMock.mockRejectedValue(new Error("falha de rede"));
    renderList({ tmdbId: 1396, seasons: SEASONS });
    await screen.findByText("1. Pilot");

    fireEvent.click(screen.getAllByLabelText("Assistido")[0]!);

    await screen.findByRole("alert");
    expect(screen.getAllByLabelText("Assistido")[0]).not.toBeChecked();
  });

  it("marca a temporada inteira sem pedir confirmação", async () => {
    getMock.mockResolvedValue(season1Response());
    putMock.mockResolvedValue(undefined);
    const confirmSpy = vi.spyOn(window, "confirm");
    renderList({ tmdbId: 1396, seasons: SEASONS });
    await screen.findByText("1. Pilot");

    fireEvent.click(screen.getByRole("button", { name: "Marcar temporada inteira" }));

    await waitFor(() =>
      expect(putMock).toHaveBeenCalledWith("/api/series/1396/seasons/1", { watched: true }),
    );
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(
      await screen.findByRole("button", { name: "Desmarcar temporada inteira" }),
    ).toBeInTheDocument();
  });

  it("pede confirmação antes de desmarcar a temporada inteira", async () => {
    getMock.mockResolvedValue(season1Response(true));
    putMock.mockResolvedValue(undefined);

    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderList({ tmdbId: 1396, seasons: SEASONS });
    await screen.findByRole("button", { name: "Desmarcar temporada inteira" });

    fireEvent.click(screen.getByRole("button", { name: "Desmarcar temporada inteira" }));
    expect(confirmSpy).toHaveBeenCalled();
    expect(putMock).not.toHaveBeenCalled();

    confirmSpy.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Desmarcar temporada inteira" }));

    await waitFor(() =>
      expect(putMock).toHaveBeenCalledWith("/api/series/1396/seasons/1", { watched: false }),
    );
  });

  it("marcar um episódio com anterior(es) não assistido(s) pergunta e marca os anteriores se confirmado", async () => {
    getMock.mockResolvedValue(season1Response());
    putMock.mockResolvedValue(undefined);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderList({ tmdbId: 1396, seasons: SEASONS });
    await screen.findByText("1. Pilot");

    // Marca direto o episódio 2 (índice 1), sem ter marcado o 1 antes.
    fireEvent.click(screen.getAllByLabelText("Assistido")[1]!);

    expect(confirmSpy).toHaveBeenCalledWith(
      "Você ainda não marcou o episódio anterior desta temporada como assistido. Marcar ele também?",
    );
    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith("/api/series/1396/episodes/1/1", { watched: true });
      expect(putMock).toHaveBeenCalledWith("/api/series/1396/episodes/1/2", { watched: true });
    });
    expect(screen.getAllByLabelText("Assistido")[0]).toBeChecked();
    expect(screen.getAllByLabelText("Assistido")[1]).toBeChecked();
  });

  it("recusando a confirmação de episódios anteriores, marca só o episódio clicado", async () => {
    getMock.mockResolvedValue(season1Response());
    putMock.mockResolvedValue(undefined);
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderList({ tmdbId: 1396, seasons: SEASONS });
    await screen.findByText("1. Pilot");

    fireEvent.click(screen.getAllByLabelText("Assistido")[1]!);

    await waitFor(() =>
      expect(putMock).toHaveBeenCalledWith("/api/series/1396/episodes/1/2", { watched: true }),
    );
    expect(putMock).not.toHaveBeenCalledWith("/api/series/1396/episodes/1/1", { watched: true });
    expect(screen.getAllByLabelText("Assistido")[0]).not.toBeChecked();
    expect(screen.getAllByLabelText("Assistido")[1]).toBeChecked();
  });

  it("marcar episódio de série abandonada pergunta se quer retomar, e chama onResume se confirmado", async () => {
    getMock.mockResolvedValue(season1Response());
    putMock.mockResolvedValue(undefined);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const onResume = vi.fn();
    renderList({ tmdbId: 1396, seasons: SEASONS, abandoned: true, onResume });
    await screen.findByText("1. Pilot");

    fireEvent.click(screen.getAllByLabelText("Assistido")[0]!);

    expect(confirmSpy).toHaveBeenCalledWith(
      "Esta série está marcada como abandonada. Quer voltar a acompanhá-la?",
    );
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it("recusando a confirmação de retomar, não chama onResume mas ainda marca o episódio", async () => {
    getMock.mockResolvedValue(season1Response());
    putMock.mockResolvedValue(undefined);
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const onResume = vi.fn();
    renderList({ tmdbId: 1396, seasons: SEASONS, abandoned: true, onResume });
    await screen.findByText("1. Pilot");

    fireEvent.click(screen.getAllByLabelText("Assistido")[0]!);

    expect(onResume).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(putMock).toHaveBeenCalledWith("/api/series/1396/episodes/1/1", { watched: true }),
    );
  });

  it("série não abandonada não pergunta nada ao marcar o 1º episódio", async () => {
    getMock.mockResolvedValue(season1Response());
    putMock.mockResolvedValue(undefined);
    const confirmSpy = vi.spyOn(window, "confirm");
    const onResume = vi.fn();
    renderList({ tmdbId: 1396, seasons: SEASONS, abandoned: false, onResume });
    await screen.findByText("1. Pilot");

    fireEvent.click(screen.getAllByLabelText("Assistido")[0]!);

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(onResume).not.toHaveBeenCalled();
  });

  it("não renderiza nada quando a série não tem temporadas", () => {
    const { container } = renderList({ tmdbId: 1396, seasons: [] });

    expect(container).toBeEmptyDOMElement();
  });
});

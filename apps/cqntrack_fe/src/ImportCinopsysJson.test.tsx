import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ImportCinopsysJson } from "./ImportCinopsysJson";

const { postMock } = vi.hoisted(() => ({ postMock: vi.fn() }));

vi.mock("./lib/api-client", () => ({
  apiClient: { post: postMock },
}));

function jsonFile(data: unknown) {
  return new File([JSON.stringify(data)], "cinopsys_backup.json", { type: "application/json" });
}

async function selectFile(content: File | unknown) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const file = content instanceof File ? content : jsonFile(content);
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  fireEvent.change(input);
}

// O contador vem num <strong> separado do resto da frase — mesmo motivo de
// findSummaryText em ImportFilmowCsv.test.tsx.
function findSummaryText(pattern: RegExp) {
  return screen.findByText(
    (_, element) => element?.tagName === "P" && pattern.test(element.textContent ?? ""),
  );
}

const BACKUP = {
  trakt: {
    movies: [
      { tmdbId: 603, title: "The Matrix", watchState: "WATCHED" },
      { tmdbId: 604, title: "Watchlist Movie", watchState: "WATCHLIST" },
      { tmdbId: null, title: "Sem tmdb", watchState: "WATCHED" },
    ],
    shows: [
      { backendId: "s1", tmdbId: 1396, title: "Breaking Bad" },
      { backendId: "s2", tmdbId: 1397, title: "Watchlist Only" },
    ],
    episodes: [
      {
        showBackendId: "s1",
        seasonNumber: 1,
        episodeNumber: 1,
        isWatched: true,
        watchedAt: "2020-03-05T03:05:10.000Z",
      },
      { showBackendId: "s1", seasonNumber: 1, episodeNumber: 2, isWatched: false },
    ],
  },
};

describe("ImportCinopsysJson", () => {
  beforeEach(() => {
    postMock.mockReset();
    // Fallback pras 2 chamadas de resumo de atividade (movies + series) ao
    // final do import — mesmo espírito do fallback em ImportFilmowCsv.test.tsx.
    postMock.mockResolvedValue(undefined);
  });

  it("mostra erro quando o arquivo não é um JSON válido", async () => {
    render(<ImportCinopsysJson />);

    await selectFile(
      new File(["não é json"], "cinopsys_backup.json", { type: "application/json" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("JSON válido");
    expect(postMock).not.toHaveBeenCalled();
  });

  it("mostra erro quando o JSON não tem o formato de backup do Cinopsys", async () => {
    render(<ImportCinopsysJson />);

    await selectFile({ foo: "bar" });

    expect(await screen.findByRole("alert")).toHaveTextContent("não parece um backup do Cinopsys");
    expect(postMock).not.toHaveBeenCalled();
  });

  it("mostra erro quando não há nenhum item importável", async () => {
    render(<ImportCinopsysJson />);

    await selectFile({ trakt: { movies: [], shows: [], episodes: [] } });

    expect(await screen.findByRole("alert")).toHaveTextContent("Nenhum item importável");
  });

  it("mapeia status watched/watchlist e agrupa episódios assistidos por série, ignorando o resto", async () => {
    // mockResolvedValueOnce é consumido por ordem global de chamada (não por
    // path) — como há 2 chamadas de activity entre os 2 imports (movies,
    // depois series), usa mockImplementation filtrando por path em vez de
    // encadear .mockResolvedValueOnce.
    postMock.mockImplementation(async (path: string) => {
      if (path === "/api/movies/import/cinopsys") {
        return {
          results: [
            { tmdbId: 603, title: "The Matrix", status: "imported" },
            { tmdbId: 604, title: "Watchlist Movie", status: "imported" },
          ],
        };
      }
      if (path === "/api/series/import/cinopsys") {
        return {
          results: [
            { tmdbId: 1396, title: "Breaking Bad", status: "imported", episodesImported: 1 },
          ],
        };
      }
      return undefined;
    });
    render(<ImportCinopsysJson />);

    await selectFile(BACKUP);

    expect(await findSummaryText(/2 filmes importados/)).toBeInTheDocument();
    expect(postMock).toHaveBeenNthCalledWith(1, "/api/movies/import/cinopsys", {
      movies: [
        { tmdbId: 603, title: "The Matrix", status: "watched" },
        { tmdbId: 604, title: "Watchlist Movie", status: "want_to_watch" },
      ],
    });
    expect(postMock).toHaveBeenNthCalledWith(2, "/api/movies/import/cinopsys/activity", {
      importedCount: 2,
    });
    expect(postMock).toHaveBeenNthCalledWith(3, "/api/series/import/cinopsys", {
      shows: [
        {
          tmdbId: 1396,
          title: "Breaking Bad",
          episodes: [{ season: 1, episode: 1, watchedAt: "2020-03-05T03:05:10.000Z" }],
        },
      ],
    });
    expect(postMock).toHaveBeenNthCalledWith(4, "/api/series/import/cinopsys/activity", {
      importedSeriesCount: 1,
      importedEpisodeCount: 1,
    });

    expect(await findSummaryText(/1 série importada/)).toBeInTheDocument();
    expect(await findSummaryText(/1 episódio marcado/)).toBeInTheDocument();

    fireEvent.click(screen.getByText("Itens ignorados no arquivo"));
    expect(screen.getByText(/1 filme sem tmdbId\/status reconhecido/)).toBeInTheDocument();
    expect(screen.getByText(/1 série sem tmdbId ou sem episódio assistido/)).toBeInTheDocument();
  });

  it("lote de filme que falha vira 'error'", async () => {
    postMock.mockRejectedValueOnce(new Error("falha de rede"));
    render(<ImportCinopsysJson />);

    await selectFile({
      trakt: {
        movies: [{ tmdbId: 603, title: "The Matrix", watchState: "WATCHED" }],
        shows: [],
        episodes: [],
      },
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("1 filme falhou");
  });

  it("baixa um JSON no formato do Cinopsys só com os filmes/séries que falharam", async () => {
    postMock.mockRejectedValue(new Error("falha de rede"));
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => "blob:mock-url");
    const revokeObjectURL = vi.fn();
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    try {
      render(<ImportCinopsysJson />);

      await selectFile({
        trakt: {
          movies: [{ tmdbId: 603, title: "The Matrix", watchState: "WATCHED" }],
          shows: [{ backendId: "s1", tmdbId: 1396, title: "Breaking Bad" }],
          episodes: [
            {
              showBackendId: "s1",
              seasonNumber: 1,
              episodeNumber: 1,
              isWatched: true,
              watchedAt: "2020-03-05T03:05:10.000Z",
            },
          ],
        },
      });

      // 2 alerts nesse caso (1 filme + 1 série falharam) — findAllByRole em
      // vez de findByRole, que rejeita quando há mais de 1 match.
      const alerts = await screen.findAllByRole("alert");
      expect(alerts.some((el) => el.textContent?.includes("1 filme falhou"))).toBe(true);
      expect(alerts.some((el) => el.textContent?.includes("1 série falhou"))).toBe(true);

      fireEvent.click(screen.getByText("Baixar JSON com os itens que falharam"));

      expect(createObjectURL).toHaveBeenCalledTimes(1);
      const blob = createObjectURL.mock.calls[0]?.[0];
      expect(blob?.type).toBe("application/json");
      const downloaded = JSON.parse(await blob!.text()) as {
        trakt: {
          movies: Array<{ tmdbId: number; title: string; watchState: string }>;
          shows: Array<{ backendId: string; tmdbId: number; title: string }>;
          episodes: Array<{ showBackendId: string; seasonNumber: number; episodeNumber: number }>;
        };
      };
      expect(downloaded.trakt.movies).toEqual([
        { tmdbId: 603, title: "The Matrix", watchState: "WATCHED" },
      ]);
      expect(downloaded.trakt.shows).toEqual([
        { backendId: "1396", tmdbId: 1396, title: "Breaking Bad" },
      ]);
      expect(downloaded.trakt.episodes).toEqual([
        {
          showBackendId: "1396",
          seasonNumber: 1,
          episodeNumber: 1,
          isWatched: true,
          watchedAt: "2020-03-05T03:05:10.000Z",
        },
      ]);
      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
    } finally {
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
      clickSpy.mockRestore();
    }
  });
});

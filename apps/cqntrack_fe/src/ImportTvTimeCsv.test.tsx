import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ImportTvTimeCsv } from "./ImportTvTimeCsv";

const { postMock } = vi.hoisted(() => ({ postMock: vi.fn() }));

vi.mock("./lib/api-client", () => ({
  apiClient: { post: postMock },
}));

const HEADER =
  "series_tvdb_id,series_imdb_id,series_uuid,title,season,episode,tvdb_id,is_watched,watched_at,rewatch_count,special";

function row(
  tvdbId: string,
  title: string,
  season: number,
  episode: number,
  watched: boolean,
  watchedAt = "2020-03-05T03:05:10Z",
) {
  return `${tvdbId},,uuid-${tvdbId},${title},${season},${episode},1,${watched},${watched ? watchedAt : ""},0,false`;
}

function csvFile(content: string) {
  return new File([content], "tvtime.csv", { type: "text/csv" });
}

async function selectFile(content: string) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const file = csvFile(content);
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

describe("ImportTvTimeCsv", () => {
  beforeEach(() => {
    postMock.mockReset();
  });

  it("mostra erro quando o CSV não tem as colunas esperadas", async () => {
    render(<ImportTvTimeCsv />);

    await selectFile("title,season,episode\nBreaking Bad,1,1");

    expect(await screen.findByRole("alert")).toHaveTextContent("series_tvdb_id");
    expect(postMock).not.toHaveBeenCalled();
  });

  it("mostra erro quando nenhuma linha está marcada como assistida", async () => {
    render(<ImportTvTimeCsv />);

    const csv = [HEADER, row("335425", "Infinity Train", 0, 1, false)].join("\n");
    await selectFile(csv);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Nenhum episódio assistido encontrado",
    );
    expect(postMock).not.toHaveBeenCalled();
  });

  it("agrupa episódios por série e manda 1 request por série, com todos os episódios assistidos juntos", async () => {
    postMock
      .mockResolvedValueOnce({
        seriesTvdbId: 335425,
        title: "Infinity Train",
        status: "imported",
        episodesImported: 2,
      })
      .mockResolvedValueOnce({
        seriesTvdbId: 332353,
        title: "Final Space",
        status: "imported",
        episodesImported: 1,
      });
    render(<ImportTvTimeCsv />);

    const csv = [
      HEADER,
      row("335425", "Infinity Train", 1, 1, true),
      row("335425", "Infinity Train", 1, 2, true),
      row("335425", "Infinity Train", 2, 1, false),
      row("332353", "Final Space", 1, 1, true),
    ].join("\n");
    await selectFile(csv);

    expect(await findSummaryText(/2 séries importadas/)).toBeInTheDocument();
    expect(postMock).toHaveBeenCalledTimes(2);
    expect(postMock).toHaveBeenNthCalledWith(1, "/api/series/import/tvtime", {
      seriesTvdbId: 335425,
      title: "Infinity Train",
      episodes: [
        { season: 1, episode: 1, watchedAt: "2020-03-05T03:05:10Z" },
        { season: 1, episode: 2, watchedAt: "2020-03-05T03:05:10Z" },
      ],
    });
    expect(postMock).toHaveBeenNthCalledWith(2, "/api/series/import/tvtime", {
      seriesTvdbId: 332353,
      title: "Final Space",
      episodes: [{ season: 1, episode: 1, watchedAt: "2020-03-05T03:05:10Z" }],
    });
    expect(await findSummaryText(/3 episódios marcados/)).toBeInTheDocument();
  });

  it("não manda request pra série sem nenhum episódio assistido", async () => {
    postMock.mockResolvedValueOnce({
      seriesTvdbId: 332353,
      title: "Final Space",
      status: "imported",
      episodesImported: 1,
    });
    render(<ImportTvTimeCsv />);

    const csv = [
      HEADER,
      row("335425", "Infinity Train", 1, 1, false),
      row("332353", "Final Space", 1, 1, true),
    ].join("\n");
    await selectFile(csv);

    await findSummaryText(/1 série importada/);
    expect(postMock).toHaveBeenCalledTimes(1);
    expect(postMock).toHaveBeenCalledWith("/api/series/import/tvtime", {
      seriesTvdbId: 332353,
      title: "Final Space",
      episodes: [{ season: 1, episode: 1, watchedAt: "2020-03-05T03:05:10Z" }],
    });
  });

  it("série que falha ao importar aparece na lista de erro, e o CSV de retry só tem as linhas dela", async () => {
    postMock.mockRejectedValue(new Error("falha de rede"));
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => "blob:mock-url");
    const revokeObjectURL = vi.fn();
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    try {
      render(<ImportTvTimeCsv />);

      const csv = [HEADER, row("335425", "Infinity Train", 1, 1, true)].join("\n");
      await selectFile(csv);

      expect(await screen.findByRole("alert")).toHaveTextContent("1 série falhou");

      fireEvent.click(screen.getByText(/Baixar CSV com a série que falhou/));

      expect(createObjectURL).toHaveBeenCalledTimes(1);
      const blob = createObjectURL.mock.calls[0]?.[0];
      await expect(blob?.text()).resolves.toBe(
        `${HEADER}\r\n${row("335425", "Infinity Train", 1, 1, true)}`,
      );
      expect(clickSpy).toHaveBeenCalledTimes(1);
    } finally {
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
      clickSpy.mockRestore();
    }
  });

  it("linha sem series_tvdb_id numérico não gera request", async () => {
    render(<ImportTvTimeCsv />);

    const csv = [HEADER, row("", "Sem TVDB", 1, 1, true)].join("\n");
    await selectFile(csv);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Nenhum episódio assistido encontrado",
    );
    expect(postMock).not.toHaveBeenCalled();
  });
});

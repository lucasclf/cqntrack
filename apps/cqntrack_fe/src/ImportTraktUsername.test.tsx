import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ImportTraktUsername } from "./ImportTraktUsername";

const { getMock, postMock } = vi.hoisted(() => ({ getMock: vi.fn(), postMock: vi.fn() }));

vi.mock("./lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("./lib/api-client")>("./lib/api-client");
  return {
    ...actual,
    apiClient: { get: getMock, post: postMock },
  };
});

const MOVIES_PREVIEW_URL = "/api/movies/import/trakt?username=alguem";
const SERIES_PREVIEW_URL = "/api/series/import/trakt?username=alguem";

// Os contadores vêm num <strong> separado do resto da frase — mesmo motivo
// de findSummaryText em ImportFilmowCsv.test.tsx/ImportTvTimeCsv.test.tsx.
function findSummaryText(pattern: RegExp) {
  return screen.findByText(
    (_, element) => element?.tagName === "P" && pattern.test(element.textContent ?? ""),
  );
}

function fillAndSubmit(username = "alguem") {
  fireEvent.change(screen.getByPlaceholderText("seu_usuario_no_trakt"), {
    target: { value: username },
  });
  fireEvent.click(screen.getByRole("button", { name: "Importar" }));
}

describe("ImportTraktUsername", () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
  });

  it("botão fica desabilitado sem username digitado", () => {
    render(<ImportTraktUsername />);
    expect(screen.getByRole("button", { name: "Importar" })).toBeDisabled();
  });

  it("perfil indisponível (404) mostra mensagem clara, sem tentar importar nada", async () => {
    const { ApiError } =
      await vi.importActual<typeof import("./lib/api-client")>("./lib/api-client");
    getMock.mockRejectedValue(new ApiError(404, "not found"));
    render(<ImportTraktUsername />);

    fillAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent("Não conseguimos acessar");
    expect(postMock).not.toHaveBeenCalled();
  });

  it("importa filmes em lote e séries 1 por request, com nota convertida", async () => {
    getMock.mockImplementation((path: string) => {
      if (path === MOVIES_PREVIEW_URL) {
        return Promise.resolve({
          importable: [{ tmdbId: 27205, title: "Inception", rating: 4 }],
          notFound: [{ title: "Filme obscuro" }],
        });
      }
      if (path === SERIES_PREVIEW_URL) {
        return Promise.resolve({
          importable: [
            {
              tmdbId: 1396,
              title: "Breaking Bad",
              rating: 4.5,
              episodes: [{ season: 1, episode: 1, watchedAt: null }],
            },
          ],
          notFound: [],
        });
      }
      return Promise.reject(new Error("rota inesperada: " + path));
    });
    postMock.mockImplementation((path: string) => {
      if (path === "/api/movies/import/trakt") {
        return Promise.resolve({
          results: [{ tmdbId: 27205, title: "Inception", status: "imported" }],
        });
      }
      if (path === "/api/series/import/trakt") {
        return Promise.resolve({
          tmdbId: 1396,
          title: "Breaking Bad",
          status: "imported",
          episodesImported: 1,
        });
      }
      // Chamadas de activity-resumo, best-effort — ver ImportTraktUsername.tsx.
      return Promise.resolve(undefined);
    });

    render(<ImportTraktUsername />);
    fillAndSubmit();

    expect(
      await findSummaryText(/1.*filme importado.*1.*série importada.*1.*episódio marcado/s),
    ).toBeInTheDocument();

    expect(postMock).toHaveBeenCalledWith("/api/movies/import/trakt", {
      items: [{ tmdbId: 27205, title: "Inception", rating: 4 }],
    });
    expect(postMock).toHaveBeenCalledWith("/api/series/import/trakt", {
      tmdbId: 1396,
      title: "Breaking Bad",
      rating: 4.5,
      episodes: [{ season: 1, episode: 1, watchedAt: null }],
    });
    expect(postMock).toHaveBeenCalledWith("/api/movies/import/trakt/activity", {
      importedCount: 1,
    });
    expect(postMock).toHaveBeenCalledWith("/api/series/import/trakt/activity", {
      importedSeriesCount: 1,
      importedEpisodeCount: 1,
    });

    // Filme sem tmdb_id no Trakt aparece na lista colapsável.
    fireEvent.click(screen.getByText(/sem tmdb_id no Trakt/));
    expect(screen.getByText("Filme obscuro")).toBeInTheDocument();
  });
});

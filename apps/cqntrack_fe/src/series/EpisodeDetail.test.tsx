import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../lib/api-client";
import { EpisodeDetail } from "./EpisodeDetail";

const { getMock, putMock } = vi.hoisted(() => ({ getMock: vi.fn(), putMock: vi.fn() }));

vi.mock("../lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("../lib/api-client")>("../lib/api-client");
  return {
    ...actual,
    apiClient: { get: getMock, put: putMock, post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  };
});

const EPISODE = {
  seasonNumber: 1,
  episodeNumber: 1,
  name: "Pilot",
  overview: "Walter White é diagnosticado com câncer.",
  airDate: "2008-01-20",
  stillUrl: "https://image.tmdb.org/t/p/w342/still-1.jpg",
  runtime: 58,
  rating: 8.2,
  watched: false,
  directors: [
    {
      personId: 66633,
      name: "Vince Gilligan",
      profileUrl: "https://image.tmdb.org/t/p/w185/gilligan.jpg",
    },
  ],
};

function renderDetail() {
  render(
    <MemoryRouter initialEntries={["/series/1396/temporadas/1/episodios/1"]}>
      <Routes>
        <Route
          path="/series/:tmdbId/temporadas/:seasonNumber/episodios/:episodeNumber"
          element={<EpisodeDetail />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("EpisodeDetail", () => {
  it("mostra nome, sinopse, meta e o diretor, linkando pra página da pessoa e de volta pra série", async () => {
    getMock.mockResolvedValue(EPISODE);
    renderDetail();

    expect(await screen.findByRole("heading", { name: "Pilot" })).toBeInTheDocument();
    expect(screen.getByText("Temporada 1 · Episódio 1")).toBeInTheDocument();
    expect(screen.getByText("Walter White é diagnosticado com câncer.")).toBeInTheDocument();
    expect(screen.getByText("2008-01-20")).toBeInTheDocument();
    expect(screen.getByText("58min")).toBeInTheDocument();
    expect(screen.getByText("★ 8.2")).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledWith("/api/series/1396/episodes/1/1");

    expect(screen.getByRole("heading", { name: "Direção" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Vince Gilligan/ })).toHaveAttribute(
      "href",
      "/pessoas/66633",
    );
    expect(screen.getByRole("link", { name: "← Voltar pra série" })).toHaveAttribute(
      "href",
      "/series/1396",
    );
  });

  it("marca/desmarca assistido, reaproveitando o mesmo endpoint da lista da temporada", async () => {
    getMock.mockResolvedValue(EPISODE);
    putMock.mockResolvedValue(undefined);
    renderDetail();

    await screen.findByRole("heading", { name: "Pilot" });
    fireEvent.click(screen.getByRole("button", { name: "Marcar como assistido" }));

    expect(putMock).toHaveBeenCalledWith("/api/series/1396/episodes/1/1", { watched: true });
    expect(await screen.findByRole("button", { name: "Desmarcar assistido" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("reverte o toggle se o PUT falhar", async () => {
    getMock.mockResolvedValue(EPISODE);
    putMock.mockRejectedValue(new Error("falha de rede"));
    renderDetail();

    await screen.findByRole("heading", { name: "Pilot" });
    fireEvent.click(screen.getByRole("button", { name: "Marcar como assistido" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Falha ao salvar");
    expect(screen.getByRole("button", { name: "Marcar como assistido" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("mostra 'episódio não encontrado' quando a API retorna 404", async () => {
    getMock.mockRejectedValue(new ApiError(404, "not found"));
    renderDetail();

    expect(await screen.findByText("Episódio não encontrado.")).toBeInTheDocument();
  });

  it("mostra mensagem de erro genérica em outras falhas", async () => {
    getMock.mockRejectedValue(new Error("falha de rede"));
    renderDetail();

    expect(await screen.findByRole("alert")).toHaveTextContent("Falha ao carregar o episódio");
  });
});

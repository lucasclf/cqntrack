import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../lib/api-client";
import { PersonDetail } from "./PersonDetail";

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock("../lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("../lib/api-client")>("../lib/api-client");
  return {
    ...actual,
    apiClient: { get: getMock, post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  };
});

const PERSON_CREDITS = {
  person: {
    personId: 525,
    name: "Christopher Nolan",
    profileUrl: "https://image.tmdb.org/t/p/w185/nolan.jpg",
    biography: "Cineasta britânico e americano.",
  },
  actingCredits: [] as unknown[],
  directingCredits: [
    {
      mediaType: "movies",
      id: 27205,
      title: "Inception",
      posterUrl: "https://image.tmdb.org/t/p/w185/inception.jpg",
      releaseDate: "2010-07-15",
      roleLabel: "Diretor",
    },
  ],
};

function renderDetail(personId = "525") {
  render(
    <MemoryRouter initialEntries={[`/pessoas/${personId}`]}>
      <Routes>
        <Route path="/pessoas/:personId" element={<PersonDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("PersonDetail", () => {
  it("mostra nome, biografia e os créditos de direção, linkando de volta pro filme", async () => {
    getMock.mockResolvedValue(PERSON_CREDITS);
    renderDetail();

    expect(await screen.findByRole("heading", { name: "Christopher Nolan" })).toBeInTheDocument();
    expect(screen.getByText("Cineasta britânico e americano.")).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledWith("/api/people/525");

    expect(screen.getByRole("heading", { name: "Como diretor" })).toBeInTheDocument();
    expect(screen.getByText("Inception")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Inception/ })).toHaveAttribute(
      "href",
      "/filmes/27205",
    );
    // Sem créditos de ator — a seção não aparece.
    expect(screen.queryByRole("heading", { name: "Como ator" })).not.toBeInTheDocument();
  });

  it("linka um crédito de série pra /series/:id", async () => {
    getMock.mockResolvedValue({
      person: { personId: 66633, name: "Vince Gilligan", profileUrl: null, biography: null },
      actingCredits: [],
      directingCredits: [
        {
          mediaType: "series",
          id: 1396,
          title: "Breaking Bad",
          posterUrl: null,
          releaseDate: "2008-01-20",
          roleLabel: "Criador e diretor",
        },
      ],
    });
    renderDetail("66633");

    expect(await screen.findByText("Breaking Bad")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Breaking Bad/ })).toHaveAttribute(
      "href",
      "/series/1396",
    );
    expect(screen.getByText(/Criador e diretor/)).toBeInTheDocument();
  });

  it("mostra mensagem quando não há créditos de ator nem de diretor", async () => {
    getMock.mockResolvedValue({
      person: { personId: 1, name: "Alguém Obscuro", profileUrl: null, biography: null },
      actingCredits: [],
      directingCredits: [],
    });
    renderDetail("1");

    expect(
      await screen.findByText("Nenhum crédito de ator ou diretor encontrado."),
    ).toBeInTheDocument();
  });

  it("mostra 'pessoa não encontrada' quando a API retorna 404", async () => {
    getMock.mockRejectedValue(new ApiError(404, "not found"));
    renderDetail();

    expect(await screen.findByText("Pessoa não encontrada.")).toBeInTheDocument();
  });

  it("mostra mensagem de erro genérica em outras falhas", async () => {
    getMock.mockRejectedValue(new Error("falha de rede"));
    renderDetail();

    expect(await screen.findByRole("alert")).toHaveTextContent("Falha ao carregar a pessoa");
  });
});

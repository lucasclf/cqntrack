import type { GameEntry, GameSummary } from "@cqntrack/shared";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GameCard } from "./GameCard";

const { putMock } = vi.hoisted(() => ({ putMock: vi.fn() }));

vi.mock("../lib/api-client", () => ({
  apiClient: { put: putMock },
}));

const BASE_GAME: GameSummary = {
  igdbId: 1942,
  name: "The Witcher 3: Wild Hunt",
  coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/coaarl.jpg",
  firstReleaseDate: "2015-05-19",
  platforms: ["PC (Microsoft Windows)", "PlayStation 4"],
  genres: ["Role-playing (RPG)"],
  rating: 92.76,
};

function renderCard(game: GameSummary, entry?: GameEntry | null, interactive = false) {
  return render(
    <MemoryRouter>
      <GameCard game={game} entry={entry} interactive={interactive} />
    </MemoryRouter>,
  );
}

describe("GameCard", () => {
  it("linka pro detalhe do jogo e mostra nome, ano, plataforma e nota arredondada", () => {
    renderCard(BASE_GAME);

    expect(screen.getByRole("link")).toHaveAttribute("href", "/jogos/1942");
    expect(screen.getByText("The Witcher 3: Wild Hunt")).toBeInTheDocument();
    expect(screen.getByText(/2015/)).toBeInTheDocument();
    expect(screen.getByText(/PC \(Microsoft Windows\)/)).toBeInTheDocument();
    expect(screen.getByText(/\+1/)).toBeInTheDocument();
    expect(screen.getByText("93")).toBeInTheDocument();
  });

  it("lida com capa, nota, plataforma e data ausentes sem quebrar", () => {
    renderCard({
      ...BASE_GAME,
      coverUrl: null,
      rating: null,
      platforms: [],
      firstReleaseDate: null,
    });

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("Data desconhecida")).toBeInTheDocument();
  });

  it("mostra status, nota pessoal e selo de favorito quando há entry", () => {
    renderCard(BASE_GAME, {
      id: "1",
      status: "completed",
      rating: 4.5,
      favoritedAt: "2026-01-01T00:00:00.000Z",
      platforms: ["PC"],
      review: null,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(screen.getByText("Finalizado")).toBeInTheDocument();
    expect(screen.getByText("★ 4.5")).toBeInTheDocument();
    expect(screen.getByLabelText("Favoritado")).toBeInTheDocument();
  });

  it("reserva a linha de status/nota mesmo quando a entry não tem nenhum dos dois", () => {
    // Favoritar não define status nem nota — sem isso, esse card fica mais
    // baixo que os vizinhos que têm status/nota, quebrando o grid (bug real).
    const { container } = renderCard(BASE_GAME, {
      id: "1",
      status: null,
      rating: null,
      favoritedAt: "2026-01-01T00:00:00.000Z",
      platforms: null,
      review: null,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(container.querySelector("p:last-child")).toBeEmptyDOMElement();
  });

  it("sem interactive, não renderiza os botões de ação rápida", () => {
    renderCard(BASE_GAME);

    expect(screen.queryByLabelText("Favoritar")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Marcar como finalizado")).not.toBeInTheDocument();
  });

  describe("interactive", () => {
    beforeEach(() => {
      putMock.mockReset();
    });

    it("favoritar chama o PUT, atualiza otimista e não navega", () => {
      putMock.mockResolvedValue({});
      renderCard(BASE_GAME, null, true);

      fireEvent.click(screen.getByLabelText("Favoritar"));

      expect(putMock).toHaveBeenCalledWith("/api/games/1942/entry", { favorited: true });
      expect(screen.getByLabelText("Desfavoritar")).toBeInTheDocument();
    });

    it("clicar em favoritar de novo desfavorita", async () => {
      putMock.mockResolvedValue({
        id: "1",
        status: null,
        rating: null,
        favoritedAt: "2026-01-01T00:00:00.000Z",
        platforms: null,
        review: null,
        updatedAt: "2026-01-01T00:00:00.000Z",
      });
      renderCard(
        BASE_GAME,
        {
          id: "1",
          status: null,
          rating: null,
          favoritedAt: "2026-01-01T00:00:00.000Z",
          platforms: null,
          review: null,
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
        true,
      );

      fireEvent.click(screen.getByLabelText("Desfavoritar"));

      expect(putMock).toHaveBeenCalledWith("/api/games/1942/entry", { favorited: false });
      await waitFor(() => expect(screen.getByLabelText("Favoritar")).toBeInTheDocument());
    });

    it("marcar como finalizado chama o PUT com status completed", () => {
      putMock.mockResolvedValue({});
      renderCard(BASE_GAME, null, true);

      fireEvent.click(screen.getByLabelText("Marcar como finalizado"));

      expect(putMock).toHaveBeenCalledWith("/api/games/1942/entry", { status: "completed" });
      expect(screen.getByLabelText("Desmarcar como finalizado")).toBeInTheDocument();
    });

    it("clicar de novo em finalizado desmarca (status: null)", () => {
      putMock.mockResolvedValue({});
      renderCard(
        BASE_GAME,
        {
          id: "1",
          status: "completed",
          rating: null,
          favoritedAt: null,
          platforms: null,
          review: null,
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
        true,
      );

      fireEvent.click(screen.getByLabelText("Desmarcar como finalizado"));

      expect(putMock).toHaveBeenCalledWith("/api/games/1942/entry", { status: null });
    });

    it("reverte a marcação otimista quando o PUT falha", async () => {
      putMock.mockRejectedValue(new Error("falha de rede"));
      renderCard(BASE_GAME, null, true);

      fireEvent.click(screen.getByLabelText("Favoritar"));
      expect(screen.getByLabelText("Desfavoritar")).toBeInTheDocument();

      await waitFor(() => expect(screen.getByLabelText("Favoritar")).toBeInTheDocument());
    });

    it("o clique no botão não navega pro detalhe (preventDefault/stopPropagation)", () => {
      putMock.mockResolvedValue({});
      renderCard(BASE_GAME, null, true);

      const clickEvent = new MouseEvent("click", { bubbles: true, cancelable: true });
      const preventDefaultSpy = vi.spyOn(clickEvent, "preventDefault");
      screen.getByLabelText("Favoritar").dispatchEvent(clickEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });
});

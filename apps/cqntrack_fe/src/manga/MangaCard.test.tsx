import type { MangaEntry, MangaSummary } from "@cqntrack/shared";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfirmDialogProvider } from "../lib/ConfirmDialogProvider";
import { MangaCard } from "./MangaCard";

const { putMock } = vi.hoisted(() => ({ putMock: vi.fn() }));

vi.mock("../lib/api-client", () => ({
  apiClient: { put: putMock },
}));

const BASE_MANGA: MangaSummary = {
  mangadexId: "manga-1",
  title: "One Piece",
  coverUrl: "https://uploads.mangadex.org/covers/manga-1/cover.jpg",
  authors: [{ id: "author-1", name: "Eiichiro Oda" }],
  tags: ["Ação", "Aventura"],
  publicationStatus: "ongoing",
  year: 1997,
};

function renderCard(manga: MangaSummary, entry?: MangaEntry | null, interactive = false) {
  return render(
    <MemoryRouter>
      <MangaCard manga={manga} entry={entry} interactive={interactive} />
    </MemoryRouter>,
  );
}

function renderInteractiveCard(manga: MangaSummary, entry?: MangaEntry | null) {
  return render(
    <ConfirmDialogProvider>
      <MemoryRouter>
        <MangaCard manga={manga} entry={entry} interactive />
      </MemoryRouter>
    </ConfirmDialogProvider>,
  );
}

describe("MangaCard", () => {
  it("linka pro detalhe do mangá e mostra título, ano e autor", () => {
    renderCard(BASE_MANGA);

    expect(screen.getByRole("link")).toHaveAttribute("href", "/mangas/manga-1");
    expect(screen.getByText("One Piece")).toBeInTheDocument();
    expect(screen.getByText(/1997/)).toBeInTheDocument();
    expect(screen.getByText(/Eiichiro Oda/)).toBeInTheDocument();
  });

  it("lida com capa, autores e ano ausentes sem quebrar", () => {
    renderCard({ ...BASE_MANGA, coverUrl: null, authors: [], year: null });

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("Ano desconhecido")).toBeInTheDocument();
  });

  it("mostra status, nota pessoal e selo de favorito quando há entry", () => {
    renderCard(BASE_MANGA, {
      id: "1",
      status: "reading",
      rating: 4.5,
      readChapterCount: 900,
      favoritedAt: "2026-01-01T00:00:00.000Z",
      review: null,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(screen.getByText("Lendo")).toBeInTheDocument();
    expect(screen.getByText("★ 4.5")).toBeInTheDocument();
    expect(screen.getByLabelText("Favoritado")).toBeInTheDocument();
  });

  it("sem interactive, não renderiza os botões de ação rápida", () => {
    renderCard(BASE_MANGA);

    expect(screen.queryByLabelText("Favoritar")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Marcar mangá inteiro como lido")).not.toBeInTheDocument();
  });

  describe("interactive", () => {
    beforeEach(() => {
      putMock.mockReset();
    });

    it("favoritar chama o PUT e atualiza otimista, sem navegar", () => {
      putMock.mockResolvedValue({});
      renderInteractiveCard(BASE_MANGA, null);

      fireEvent.click(screen.getByLabelText("Favoritar"));

      expect(putMock).toHaveBeenCalledWith("/api/manga/manga-1/entry", { favorited: true });
      expect(screen.getByLabelText("Desfavoritar")).toBeInTheDocument();
    });

    it("marcar o mangá inteiro pede confirmação e chama o PUT read-all", async () => {
      putMock.mockResolvedValue(undefined);
      renderInteractiveCard(BASE_MANGA, null);

      fireEvent.click(screen.getByLabelText("Marcar mangá inteiro como lido"));
      expect(
        await screen.findByText("Marcar todos os capítulos deste mangá como lidos?"),
      ).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

      await waitFor(() => expect(putMock).toHaveBeenCalledWith("/api/manga/manga-1/read-all"));
      expect(await screen.findByText("Lido")).toBeInTheDocument();
    });

    it("cancelando a confirmação, não chama o PUT read-all", async () => {
      renderInteractiveCard(BASE_MANGA, null);

      fireEvent.click(screen.getByLabelText("Marcar mangá inteiro como lido"));
      fireEvent.click(await screen.findByRole("button", { name: "Cancelar" }));

      expect(putMock).not.toHaveBeenCalledWith("/api/manga/manga-1/read-all");
    });

    it("o clique nos botões não navega pro detalhe (preventDefault)", () => {
      putMock.mockResolvedValue({});
      renderInteractiveCard(BASE_MANGA, null);

      const clickEvent = new MouseEvent("click", { bubbles: true, cancelable: true });
      const preventDefaultSpy = vi.spyOn(clickEvent, "preventDefault");
      screen.getByLabelText("Favoritar").dispatchEvent(clickEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });
});

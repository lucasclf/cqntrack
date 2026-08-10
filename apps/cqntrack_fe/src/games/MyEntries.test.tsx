import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MyEntries } from "./MyEntries";

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock("../lib/games-client", () => ({
  gamesClient: { get: getMock },
}));

const ENTRY = {
  id: "1",
  status: "playing" as const,
  rating: 4,
  favoriteSlot: null,
  platforms: ["PC"],
  review: null,
  updatedAt: "2026-01-01T00:00:00.000Z",
  game: {
    igdbId: 1942,
    name: "The Witcher 3: Wild Hunt",
    coverUrl: null,
    firstReleaseDate: "2015-05-19",
    platforms: [],
    genres: [],
    rating: null,
  },
};

function renderPage() {
  render(
    <MemoryRouter>
      <MyEntries />
    </MemoryRouter>,
  );
}

function lastQuery(): URLSearchParams {
  const call = getMock.mock.calls.at(-1) as [string];
  return new URLSearchParams(call[0].split("?")[1]);
}

describe("MyEntries", () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it("carrega a primeira página com os filtros padrão", async () => {
    getMock.mockResolvedValue({ items: [ENTRY], page: 1, pageSize: 24, total: 1 });
    renderPage();

    expect(await screen.findByText("The Witcher 3: Wild Hunt")).toBeInTheDocument();
    const query = lastQuery();
    expect(query.get("sortBy")).toBe("updatedAt");
    expect(query.get("order")).toBe("desc");
    expect(query.get("page")).toBe("1");
  });

  it("mostra mensagem quando não há marcações com os filtros atuais", async () => {
    getMock.mockResolvedValue({ items: [], page: 1, pageSize: 24, total: 0 });
    renderPage();

    expect(await screen.findByText("Nenhuma marcação encontrada com esses filtros.")).toBeInTheDocument();
  });

  it("mostra erro quando a busca falha", async () => {
    getMock.mockRejectedValue(new Error("falha de rede"));
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Falha ao carregar suas marcações");
  });

  it("refaz a busca com o novo status ao trocar o filtro", async () => {
    getMock.mockResolvedValue({ items: [ENTRY], page: 1, pageSize: 24, total: 1 });
    renderPage();
    await screen.findByText("The Witcher 3: Wild Hunt");

    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "playing" } });

    await screen.findByText("The Witcher 3: Wild Hunt");
    expect(lastQuery().get("status")).toBe("playing");
  });

  it("navega entre páginas e reseta pra página 1 ao mudar um filtro", async () => {
    getMock.mockResolvedValue({ items: [ENTRY], page: 1, pageSize: 24, total: 50 });
    renderPage();
    await screen.findByText("The Witcher 3: Wild Hunt");

    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    await act(async () => {});
    expect(lastQuery().get("page")).toBe("2");

    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "playing" } });
    await act(async () => {});
    expect(lastQuery().get("page")).toBe("1");
  });
});

describe("MyEntries com debounce de plataforma", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    getMock.mockReset();
    getMock.mockResolvedValue({ items: [], page: 1, pageSize: 24, total: 0 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("só filtra por plataforma 300ms depois de parar de digitar", async () => {
    render(
      <MemoryRouter>
        <MyEntries />
      </MemoryRouter>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    fireEvent.change(screen.getByPlaceholderText("ex.: PS5"), { target: { value: "PS5" } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(299);
    });
    expect(lastQuery().get("platform")).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(lastQuery().get("platform")).toBe("PS5");
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MovieEntryFilters } from "./MovieEntryFilters";

function renderFilters(overrides: Partial<Parameters<typeof MovieEntryFilters>[0]> = {}) {
  const props = {
    favoriteOnly: false,
    onFavoriteOnlyChange: vi.fn(),
    watched: "" as const,
    onWatchedChange: vi.fn(),
    sortBy: "updatedAt" as const,
    onSortByChange: vi.fn(),
    order: "desc" as const,
    onOrderChange: vi.fn(),
    ...overrides,
  };
  render(<MovieEntryFilters {...props} />);
  return props;
}

describe("MovieEntryFilters", () => {
  it("dispara onWatchedChange ao trocar o filtro de assistido", () => {
    const props = renderFilters();

    fireEvent.change(screen.getByLabelText("Assistido"), { target: { value: "true" } });

    expect(props.onWatchedChange).toHaveBeenCalledWith("true");
  });

  it("dispara onSortByChange ao trocar a ordenação", () => {
    const props = renderFilters();

    fireEvent.change(screen.getByLabelText("Ordenar por"), { target: { value: "rating" } });

    expect(props.onSortByChange).toHaveBeenCalledWith("rating");
  });

  it("alterna a ordem ao clicar no botão", () => {
    const props = renderFilters({ order: "desc" });

    fireEvent.click(screen.getByRole("button", { name: "Decrescente ↓" }));

    expect(props.onOrderChange).toHaveBeenCalledWith("asc");
  });

  it("dispara onFavoriteOnlyChange ao marcar o checkbox", () => {
    const props = renderFilters();

    fireEvent.click(screen.getByLabelText("Somente favoritos"));

    expect(props.onFavoriteOnlyChange).toHaveBeenCalledWith(true);
  });
});

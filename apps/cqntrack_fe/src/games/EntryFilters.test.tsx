import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EntryFilters } from "./EntryFilters";

function renderFilters(overrides: Partial<Parameters<typeof EntryFilters>[0]> = {}) {
  const props = {
    status: "" as const,
    onStatusChange: vi.fn(),
    favoriteOnly: false,
    onFavoriteOnlyChange: vi.fn(),
    platform: "",
    onPlatformChange: vi.fn(),
    sortBy: "updatedAt" as const,
    onSortByChange: vi.fn(),
    order: "desc" as const,
    onOrderChange: vi.fn(),
    ...overrides,
  };
  render(<EntryFilters {...props} />);
  return props;
}

describe("EntryFilters", () => {
  it("dispara onStatusChange ao trocar o status", () => {
    const props = renderFilters();

    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "playing" } });

    expect(props.onStatusChange).toHaveBeenCalledWith("playing");
  });

  it("dispara onPlatformChange ao digitar", () => {
    const props = renderFilters();

    fireEvent.change(screen.getByPlaceholderText("ex.: PS5"), { target: { value: "Switch" } });

    expect(props.onPlatformChange).toHaveBeenCalledWith("Switch");
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

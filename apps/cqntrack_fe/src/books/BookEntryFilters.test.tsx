import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BookEntryFilters } from "./BookEntryFilters";

function renderFilters(overrides: Partial<Parameters<typeof BookEntryFilters>[0]> = {}) {
  const props = {
    status: "" as const,
    onStatusChange: vi.fn(),
    favoriteOnly: false,
    onFavoriteOnlyChange: vi.fn(),
    sortBy: "updatedAt" as const,
    onSortByChange: vi.fn(),
    order: "desc" as const,
    onOrderChange: vi.fn(),
    ...overrides,
  };
  render(<BookEntryFilters {...props} />);
  return props;
}

describe("BookEntryFilters", () => {
  it("dispara onStatusChange ao trocar o status", () => {
    const props = renderFilters();

    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "reading" } });

    expect(props.onStatusChange).toHaveBeenCalledWith("reading");
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

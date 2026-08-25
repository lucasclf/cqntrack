import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SubTabs } from "./SubTabs";

const TABS = [
  { key: "a" as const, label: "Aba A" },
  { key: "b" as const, label: "Aba B" },
  { key: "c" as const, label: "Aba C" },
];

describe("SubTabs", () => {
  it("marca a aba ativa e chama onChange ao clicar noutra", () => {
    const onChange = vi.fn();
    render(<SubTabs tabs={TABS} active="b" onChange={onChange} />);

    expect(screen.getByRole("tab", { name: "Aba B" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Aba A" })).toHaveAttribute("aria-selected", "false");

    fireEvent.click(screen.getByRole("tab", { name: "Aba C" }));
    expect(onChange).toHaveBeenCalledWith("c");
  });
});

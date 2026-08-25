import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FriendsPage } from "./FriendsPage";

// Orquestração de abas isolada dos componentes de verdade (cada um já tem
// cobertura própria — FollowingList.test.tsx, SearchUsers.test.tsx e
// FriendActivityFeed.test.tsx), mesmo espírito de ActivityTab.tsx (que não
// tem teste próprio, só o ActivityFeed que ele envolve).
vi.mock("./FollowingList", () => ({ FollowingList: () => <p>conteúdo de listar</p> }));
vi.mock("./FriendActivityFeed", () => ({
  FriendActivityFeed: () => <p>conteúdo de atividades</p>,
}));
vi.mock("./SearchUsers", () => ({ SearchUsers: () => <p>conteúdo de procurar</p> }));

describe("FriendsPage", () => {
  it("mostra a aba 'Listar' por padrão", () => {
    render(<FriendsPage />);

    expect(screen.getByRole("tab", { name: "Listar" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("conteúdo de listar")).toBeInTheDocument();
    expect(screen.queryByText("conteúdo de atividades")).not.toBeInTheDocument();
    expect(screen.queryByText("conteúdo de procurar")).not.toBeInTheDocument();
  });

  it("troca pra 'Atividades'", () => {
    render(<FriendsPage />);

    fireEvent.click(screen.getByRole("tab", { name: "Atividades" }));

    expect(screen.getByText("conteúdo de atividades")).toBeInTheDocument();
    expect(screen.queryByText("conteúdo de listar")).not.toBeInTheDocument();
  });

  it("troca pra 'Procurar'", () => {
    render(<FriendsPage />);

    fireEvent.click(screen.getByRole("tab", { name: "Procurar" }));

    expect(screen.getByText("conteúdo de procurar")).toBeInTheDocument();
    expect(screen.queryByText("conteúdo de listar")).not.toBeInTheDocument();
  });
});

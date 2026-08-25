import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FollowingList } from "./FollowingList";

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock("../lib/api-client", () => ({
  apiClient: { get: getMock },
}));

function renderList() {
  render(
    <MemoryRouter>
      <FollowingList />
    </MemoryRouter>,
  );
}

describe("FollowingList", () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it("mostra mensagem quando não segue ninguém", async () => {
    getMock.mockResolvedValue({ items: [] });
    renderList();

    expect(await screen.findByText("Você ainda não segue ninguém.")).toBeInTheDocument();
  });

  it("mostra erro quando a busca falha", async () => {
    getMock.mockRejectedValue(new Error("falha de rede"));
    renderList();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Falha ao carregar sua lista de amigos",
    );
  });

  it("mostra avatar+nome de cada pessoa seguida, linkando pro perfil, sem botão de deixar de seguir", async () => {
    getMock.mockResolvedValue({
      items: [
        { username: "amigo1", displayUsername: "Amigo Um", image: null },
        {
          username: "amigo2",
          displayUsername: "Amigo Dois",
          image: "https://cdn.example.com/a.png",
        },
      ],
    });
    renderList();

    expect(await screen.findByText("Amigo Um")).toBeInTheDocument();
    expect(screen.getByText("Amigo Dois")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Amigo Um/ })).toHaveAttribute("href", "/@amigo1");
    expect(screen.getByRole("link", { name: /Amigo Dois/ })).toHaveAttribute("href", "/@amigo2");
    expect(screen.queryByRole("button", { name: "Deixar de seguir" })).not.toBeInTheDocument();
  });
});

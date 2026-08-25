import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FollowButton } from "./FollowButton";

const { useSessionMock } = vi.hoisted(() => ({ useSessionMock: vi.fn() }));
const { getMock, putMock, deleteMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  putMock: vi.fn(),
  deleteMock: vi.fn(),
}));

vi.mock("../lib/auth-client", () => ({
  authClient: { useSession: useSessionMock },
}));

vi.mock("../lib/api-client", () => ({
  apiClient: { get: getMock, put: putMock, delete: deleteMock },
}));

function renderButton(username: string) {
  return render(
    <MemoryRouter>
      <FollowButton username={username} />
    </MemoryRouter>,
  );
}

describe("FollowButton", () => {
  beforeEach(() => {
    useSessionMock.mockReset();
    getMock.mockReset();
    putMock.mockReset();
    deleteMock.mockReset();
  });

  it("sem sessão, não renderiza nada", () => {
    useSessionMock.mockReturnValue({ data: null });

    renderButton("outra_pessoa");

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(getMock).not.toHaveBeenCalled();
  });

  it("vendo o próprio perfil, não renderiza nada", () => {
    useSessionMock.mockReturnValue({ data: { user: { username: "lucas" } } });

    renderButton("lucas");

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(getMock).not.toHaveBeenCalled();
  });

  it("logado, vendo outra pessoa que ainda não segue — mostra 'Seguir'", async () => {
    useSessionMock.mockReturnValue({ data: { user: { username: "lucas" } } });
    getMock.mockResolvedValue({ following: false });

    renderButton("outra_pessoa");

    expect(await screen.findByRole("button", { name: "Seguir" })).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledWith("/api/social/follow/outra_pessoa/status");
  });

  it("clicar em 'Seguir' chama PUT e alterna pra 'Seguindo'", async () => {
    useSessionMock.mockReturnValue({ data: { user: { username: "lucas" } } });
    getMock.mockResolvedValue({ following: false });
    putMock.mockResolvedValue(undefined);

    renderButton("outra_pessoa");
    fireEvent.click(await screen.findByRole("button", { name: "Seguir" }));

    expect(putMock).toHaveBeenCalledWith("/api/social/follow/outra_pessoa");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Seguindo" })).toBeInTheDocument();
    });
  });

  it("já seguindo, clicar chama DELETE e alterna pra 'Seguir'", async () => {
    useSessionMock.mockReturnValue({ data: { user: { username: "lucas" } } });
    getMock.mockResolvedValue({ following: true });
    deleteMock.mockResolvedValue(undefined);

    renderButton("outra_pessoa");
    fireEvent.click(await screen.findByRole("button", { name: "Seguindo" }));

    expect(deleteMock).toHaveBeenCalledWith("/api/social/follow/outra_pessoa");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Seguir" })).toBeInTheDocument();
    });
  });

  it("falha na chamada reverte o estado otimista", async () => {
    useSessionMock.mockReturnValue({ data: { user: { username: "lucas" } } });
    getMock.mockResolvedValue({ following: false });
    putMock.mockRejectedValue(new Error("falha de rede"));

    renderButton("outra_pessoa");
    fireEvent.click(await screen.findByRole("button", { name: "Seguir" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Seguir" })).toBeInTheDocument();
    });
  });
});

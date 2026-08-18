import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AvatarUpload } from "./AvatarUpload";

const { putFormMock, updateUserMock } = vi.hoisted(() => ({
  putFormMock: vi.fn(),
  updateUserMock: vi.fn(),
}));

vi.mock("./lib/api-client", () => ({
  apiClient: { putForm: putFormMock },
}));

vi.mock("./lib/auth-client", () => ({
  authClient: { updateUser: updateUserMock },
}));

function selectFile(file: File) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  fireEvent.change(input);
}

function imageFile(name = "avatar.png", type = "image/png", sizeBytes = 100) {
  return new File([new Uint8Array(sizeBytes)], name, { type });
}

describe("AvatarUpload", () => {
  beforeEach(() => {
    putFormMock.mockReset();
    updateUserMock.mockReset();
  });

  it("sem imagem, mostra o placeholder genérico", () => {
    render(<AvatarUpload imageUrl={null} />);

    expect(document.querySelector("img")).not.toBeInTheDocument();
    expect(document.querySelector("svg")).toBeInTheDocument();
  });

  it("com imagem, mostra o avatar atual", () => {
    render(<AvatarUpload imageUrl="https://cdn.example.com/avatar.png" />);

    expect(document.querySelector("img")).toHaveAttribute(
      "src",
      "https://cdn.example.com/avatar.png",
    );
  });

  it("sobe o arquivo e persiste a URL via authClient.updateUser", async () => {
    putFormMock.mockResolvedValue({ url: "https://cdn.example.com/novo.png" });
    updateUserMock.mockResolvedValue({ error: null });
    render(<AvatarUpload imageUrl={null} />);

    selectFile(imageFile());

    expect(await screen.findByText("Foto atualizada.")).toBeInTheDocument();
    expect(putFormMock).toHaveBeenCalledWith("/api/me/avatar", expect.any(FormData));
    expect(updateUserMock).toHaveBeenCalledWith({ image: "https://cdn.example.com/novo.png" });
  });

  it("rejeita tipo de arquivo não suportado sem chamar a API", async () => {
    render(<AvatarUpload imageUrl={null} />);

    selectFile(imageFile("nota.txt", "text/plain"));

    expect(await screen.findByRole("alert")).toHaveTextContent("Formato não suportado");
    expect(putFormMock).not.toHaveBeenCalled();
  });

  it("rejeita arquivo maior que 5MB sem chamar a API", async () => {
    render(<AvatarUpload imageUrl={null} />);

    selectFile(imageFile("grande.png", "image/png", 6 * 1024 * 1024));

    expect(await screen.findByRole("alert")).toHaveTextContent("Imagem muito grande");
    expect(putFormMock).not.toHaveBeenCalled();
  });

  it("falha no upload mostra erro", async () => {
    putFormMock.mockRejectedValue(new Error("falha de rede"));
    render(<AvatarUpload imageUrl={null} />);

    selectFile(imageFile());

    expect(await screen.findByRole("alert")).toHaveTextContent("Falha ao enviar a imagem");
    expect(updateUserMock).not.toHaveBeenCalled();
  });
});

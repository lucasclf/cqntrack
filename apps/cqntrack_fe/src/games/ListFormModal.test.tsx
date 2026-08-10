import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GamesApiError } from "../lib/games-client";
import { ListFormModal } from "./ListFormModal";

describe("ListFormModal", () => {
  it("modo criar: envia nome e descrição preenchidos e fecha o modal", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(<ListFormModal mode="create" onSubmit={onSubmit} onClose={onClose} />);

    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Quero jogar" } });
    fireEvent.change(screen.getByLabelText("Descrição (opcional)"), { target: { value: "Backlog" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(onSubmit).toHaveBeenCalledWith({ name: "Quero jogar", description: "Backlog" });
    expect(await screen.findByRole("button", { name: "Salvar" })).toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
  });

  it("modo editar: pré-preenche os campos com os valores iniciais", () => {
    render(
      <ListFormModal
        mode="edit"
        initialValues={{ name: "Nome antigo", description: "Descrição antiga" }}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByDisplayValue("Nome antigo")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Descrição antiga")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Editar lista" })).toBeInTheDocument();
  });

  it("mostra mensagem específica quando o nome já existe (409)", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new GamesApiError(409, "duplicate"));
    render(<ListFormModal mode="create" onSubmit={onSubmit} onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Odiei" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Já existe uma lista com esse nome.");
  });

  it("cancelar fecha o modal sem chamar onSubmit", () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();
    render(<ListFormModal mode="create" onSubmit={onSubmit} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});

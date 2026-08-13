import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ImportFilmowCsv } from "./ImportFilmowCsv";

const { postMock } = vi.hoisted(() => ({ postMock: vi.fn() }));

vi.mock("./lib/api-client", () => ({
  apiClient: { post: postMock },
}));

function csvFile(content: string) {
  return new File([content], "filmes.csv", { type: "text/csv" });
}

async function selectFile(content: string) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const file = csvFile(content);
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  fireEvent.change(input);
}

// O contador vem num <strong> separado do resto da frase (“<strong>1</strong>
// filme importado...”) — getByText só olha o texto próprio de cada nó, sem
// juntar com o de elementos filhos, então um regex direto nunca bate. Junta
// o textContent inteiro do <p> antes de comparar.
function findSummaryText(pattern: RegExp) {
  return screen.findByText(
    (_, element) => element?.tagName === "P" && pattern.test(element.textContent ?? ""),
  );
}

describe("ImportFilmowCsv", () => {
  beforeEach(() => {
    postMock.mockReset();
  });

  it("mostra erro quando o CSV não tem coluna 'Title'", async () => {
    render(<ImportFilmowCsv />);

    await selectFile("Nome\nThe Matrix");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      'O CSV precisa ter uma coluna "Title"',
    );
    expect(postMock).not.toHaveBeenCalled();
  });

  it("mostra erro quando o CSV não tem nenhum título", async () => {
    render(<ImportFilmowCsv />);

    await selectFile("Title\n");

    expect(await screen.findByRole("alert")).toHaveTextContent("Nenhum título encontrado");
  });

  it("importa os títulos da coluna Title e mostra o resumo", async () => {
    postMock.mockResolvedValue({
      results: [
        {
          title: "The Matrix",
          status: "imported",
          movie: {
            tmdbId: 603,
            name: "The Matrix",
            posterUrl: null,
            releaseDate: null,
            genres: [],
            runtime: null,
            rating: null,
          },
        },
        { title: "Filme Inexistente XYZ", status: "not_found", movie: null },
      ],
    });
    render(<ImportFilmowCsv />);

    await selectFile("Title\nThe Matrix\nFilme Inexistente XYZ");

    expect(await findSummaryText(/1 filme importado/)).toBeInTheDocument();
    expect(postMock).toHaveBeenCalledWith("/api/movies/import/filmow", {
      titles: ["The Matrix", "Filme Inexistente XYZ"],
    });
    expect(screen.getByText("1 não encontrado")).toBeInTheDocument();

    fireEvent.click(screen.getByText("1 não encontrado"));
    expect(screen.getByText("Filme Inexistente XYZ")).toBeInTheDocument();
  });

  it("lida com campos entre aspas contendo vírgula", async () => {
    postMock.mockResolvedValue({ results: [{ title: "A, B", status: "imported", movie: null }] });
    render(<ImportFilmowCsv />);

    await selectFile('Title\n"A, B"');

    expect(await findSummaryText(/1 filme importado/)).toBeInTheDocument();
    expect(postMock).toHaveBeenCalledWith("/api/movies/import/filmow", { titles: ["A, B"] });
  });

  it("quebra em lotes de 20 títulos por request", async () => {
    postMock.mockResolvedValue({ results: [] });
    const titles = Array.from({ length: 25 }, (_, i) => `Filme ${i}`);
    render(<ImportFilmowCsv />);

    await selectFile(`Title\n${titles.join("\n")}`);

    await vi.waitFor(() => expect(postMock).toHaveBeenCalledTimes(2));
    expect(postMock).toHaveBeenNthCalledWith(1, "/api/movies/import/filmow", {
      titles: titles.slice(0, 20),
    });
    expect(postMock).toHaveBeenNthCalledWith(2, "/api/movies/import/filmow", {
      titles: titles.slice(20),
    });
  });

  it("lote que falha vira 'error' pros títulos daquele lote, sem travar o restante", async () => {
    postMock.mockRejectedValue(new Error("falha de rede"));
    render(<ImportFilmowCsv />);

    await selectFile("Title\nThe Matrix");

    expect(await screen.findByRole("alert")).toHaveTextContent("1 título falhou");
  });
});

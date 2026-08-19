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
    // Fallback pra chamada de resumo de atividade ao final do import (ver
    // logFilmowImportActivity) — testes que empilham .mockResolvedValueOnce
    // só pros requests de import continuam funcionando, essa 1 chamada a
    // mais cai nesse default em vez de ficar sem stub (undefined quebraria
    // o .catch() no componente).
    postMock.mockResolvedValue(undefined);
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

  it("importa os títulos da coluna Title (1 por request) e mostra o resumo", async () => {
    postMock
      .mockResolvedValueOnce({
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
        ],
      })
      .mockResolvedValueOnce({
        results: [{ title: "Filme Inexistente XYZ", status: "not_found", movie: null }],
      });
    render(<ImportFilmowCsv />);

    await selectFile("Title\nThe Matrix\nFilme Inexistente XYZ");

    expect(await findSummaryText(/1 filme importado/)).toBeInTheDocument();
    expect(postMock).toHaveBeenNthCalledWith(1, "/api/movies/import/filmow", {
      titles: ["The Matrix"],
    });
    expect(postMock).toHaveBeenNthCalledWith(2, "/api/movies/import/filmow", {
      titles: ["Filme Inexistente XYZ"],
    });
    // Resumo agregado (ver logFilmowImportActivity), disparado 1x ao final
    // do loop — não 1 por título.
    expect(postMock).toHaveBeenNthCalledWith(3, "/api/movies/import/filmow/activity", {
      importedCount: 1,
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

  it("manda 1 título por request", async () => {
    postMock.mockResolvedValue({ results: [] });
    const titles = Array.from({ length: 3 }, (_, i) => `Filme ${i}`);
    render(<ImportFilmowCsv />);

    await selectFile(`Title\n${titles.join("\n")}`);

    await vi.waitFor(() => expect(postMock).toHaveBeenCalledTimes(3));
    for (const [index, title] of titles.entries()) {
      expect(postMock).toHaveBeenNthCalledWith(index + 1, "/api/movies/import/filmow", {
        titles: [title],
      });
    }
  });

  it("título que falha vira 'error' direto, sem retry", async () => {
    postMock.mockRejectedValue(new Error("falha de rede"));
    render(<ImportFilmowCsv />);

    await selectFile("Title\nThe Matrix");

    expect(await screen.findByRole("alert")).toHaveTextContent("1 título falhou");
    expect(postMock).toHaveBeenCalledTimes(1);
  });

  it("mostra o nome dos títulos que falharam ao expandir a lista", async () => {
    postMock.mockRejectedValue(new Error("falha de rede"));
    render(<ImportFilmowCsv />);

    await selectFile("Title\nThe Matrix\nBacurau");

    expect(await screen.findByRole("alert")).toHaveTextContent("2 títulos falharam");

    fireEvent.click(screen.getByText("Ver os títulos que falharam"));

    expect(screen.getByText("The Matrix")).toBeInTheDocument();
    expect(screen.getByText("Bacurau")).toBeInTheDocument();
  });

  it("baixa um CSV só com os títulos que falharam", async () => {
    postMock.mockRejectedValue(new Error("falha de rede"));
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => "blob:mock-url");
    const revokeObjectURL = vi.fn();
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    try {
      render(<ImportFilmowCsv />);

      await selectFile("Title\nThe Matrix\nBacurau");

      await screen.findByRole("alert");
      fireEvent.click(screen.getByText(/Baixar CSV com os títulos que falharam/));

      expect(createObjectURL).toHaveBeenCalledTimes(1);
      const blob = createObjectURL.mock.calls[0]?.[0];
      expect(blob?.type).toBe("text/csv;charset=utf-8;");
      await expect(blob?.text()).resolves.toBe("Title\r\nThe Matrix\r\nBacurau");
      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
    } finally {
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
      clickSpy.mockRestore();
    }
  });
});

import { describe, expect, it } from "vitest";
import { parseCsv, titlesToCsv } from "./parseCsv";

describe("parseCsv", () => {
  it("separa linhas e colunas simples", () => {
    expect(parseCsv("Title\nThe Matrix\nBacurau")).toEqual([
      ["Title"],
      ["The Matrix"],
      ["Bacurau"],
    ]);
  });

  it("mantém vírgula dentro de campo entre aspas", () => {
    expect(parseCsv('Title\n"Three Billboards Outside Ebbing, Missouri"\nJoker')).toEqual([
      ["Title"],
      ["Three Billboards Outside Ebbing, Missouri"],
      ["Joker"],
    ]);
  });

  it("interpreta aspas duplicadas como aspas literal dentro de campo entre aspas", () => {
    expect(parseCsv('Title\n"O Filme ""Especial"""')).toEqual([["Title"], ['O Filme "Especial"']]);
  });

  it("ignora linhas em branco", () => {
    expect(parseCsv("Title\n\nThe Matrix\n\n")).toEqual([["Title"], ["The Matrix"]]);
  });

  it("trata aspa solta no meio de um campo não-cotado como caractere literal", () => {
    // Sem esse cuidado, a aspa em "Alien 3\"" abriria um campo cotado e
    // engoliria todas as linhas seguintes até achar outra aspa — foi
    // exatamente isso que corrompeu boa parte de um CSV real do Filmow com
    // encoding quebrado.
    expect(parseCsv('Title\nAlien 3"\nBacurau')).toEqual([["Title"], ['Alien 3"'], ["Bacurau"]]);
  });

  it("lida com múltiplas colunas", () => {
    expect(parseCsv("Title,Year\nThe Matrix,1999")).toEqual([
      ["Title", "Year"],
      ["The Matrix", "1999"],
    ]);
  });
});

describe("titlesToCsv", () => {
  it("gera CSV com cabeçalho Title e um título por linha", () => {
    expect(titlesToCsv(["The Matrix", "Bacurau"])).toBe("Title\r\nThe Matrix\r\nBacurau");
  });

  it("entre aspas um título que tem vírgula", () => {
    expect(titlesToCsv(["Three Billboards Outside Ebbing, Missouri"])).toBe(
      'Title\r\n"Three Billboards Outside Ebbing, Missouri"',
    );
  });

  it("dobra aspas internas de um título que já tem aspas", () => {
    expect(titlesToCsv(['O Filme "Especial"'])).toBe('Title\r\n"O Filme ""Especial"""');
  });

  it("é lido de volta pelo parseCsv sem perder títulos", () => {
    const titles = ["The Matrix", "Three Billboards Outside Ebbing, Missouri", 'O Filme "X"'];
    const rows = parseCsv(titlesToCsv(titles));
    expect(rows.slice(1).map((row) => row[0])).toEqual(titles);
  });
});

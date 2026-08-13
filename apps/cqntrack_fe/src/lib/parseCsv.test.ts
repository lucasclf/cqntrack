import { describe, expect, it } from "vitest";
import { parseCsv } from "./parseCsv";

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

  it("lida com múltiplas colunas", () => {
    expect(parseCsv("Title,Year\nThe Matrix,1999")).toEqual([
      ["Title", "Year"],
      ["The Matrix", "1999"],
    ]);
  });
});

import { describe, expect, it } from "vitest";
import { isUniqueConstraintError } from "./is-unique-constraint-error";

describe("isUniqueConstraintError", () => {
  it("reconhece erro de constraint UNIQUE na mensagem direta", () => {
    expect(isUniqueConstraintError(new Error("UNIQUE constraint failed: game_list.name"))).toBe(
      true,
    );
  });

  it("percorre a cadeia de `cause` até achar a constraint", () => {
    const sqliteError = new Error("D1_ERROR: UNIQUE constraint failed: game_list.name");
    const drizzleError = new Error("Query failed", { cause: sqliteError });
    expect(isUniqueConstraintError(drizzleError)).toBe(true);
  });

  it("retorna false pra erro sem relação com constraint UNIQUE", () => {
    expect(isUniqueConstraintError(new Error("network timeout"))).toBe(false);
  });

  it("retorna false pra valor que não é Error", () => {
    expect(isUniqueConstraintError("string qualquer")).toBe(false);
    expect(isUniqueConstraintError(null)).toBe(false);
    expect(isUniqueConstraintError(undefined)).toBe(false);
  });
});

// O D1/drizzle envolve o erro real do SQLite numa cadeia de `cause`
// (DrizzleQueryError -> D1_ERROR -> SQLITE_CONSTRAINT) — precisa percorrer
// a cadeia toda, checar só error.message não é suficiente. Compartilhado
// pelos 4 `lists.service.ts` (games/movies/series/books): eram 4 cópias
// idênticas, ver histórico do repo.
export function isUniqueConstraintError(error: unknown): boolean {
  let current: unknown = error;
  while (current instanceof Error) {
    if (current.message.includes("UNIQUE constraint failed")) {
      return true;
    }
    current = current.cause;
  }
  return false;
}

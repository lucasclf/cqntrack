// Remove só as chaves com valor `undefined` (mantém `null` — usado em updates
// parciais onde undefined = "não mexer no campo" e null = "limpar o campo").
export function withoutUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

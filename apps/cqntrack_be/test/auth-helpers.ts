import type { Hono } from "hono";

// Cria um usuário único e retorna o cookie de sessão pronto pra usar em testes
// de outras rotas protegidas — não testa o fluxo de auth em si (isso já é
// coberto em src/auth/auth.test.ts).
export async function createAuthenticatedUser(
  app: Hono<{ Bindings: Env }>,
  env: Env,
): Promise<{ cookie: string; email: string; username: string }> {
  const suffix = crypto.randomUUID();
  const email = `teste-${suffix}@cqntrack.dev`;
  const username = `teste_${suffix.slice(0, 8)}`;

  const res = await app.request(
    "/api/auth/sign-up/email",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Teste", username, email, password: "senha12345" }),
    },
    env,
  );

  const setCookie = res.headers.get("set-cookie");
  const [cookie] = setCookie?.split(";") ?? [];
  if (!cookie) {
    throw new Error("Falha ao criar usuário de teste: resposta não trouxe Set-Cookie");
  }

  return { cookie, email, username };
}

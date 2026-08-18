import { eq } from "drizzle-orm";
import type { Hono } from "hono";
import { vi } from "vitest";
import { createDb } from "../src/db/client";
import { user } from "../src/db/schema";

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
  const password = "senha12345";

  // O cadastro em si não roda mais com fetch mockado (só a chamada que
  // tenta mandar o e-mail de verificação seria bloqueada) — como
  // requireEmailVerification está ligado, o cadastro não cria sessão.
  // Marca o usuário como verificado direto no banco, sem depender de um
  // token de verificação de verdade, e loga em seguida pra pegar um
  // cookie de sessão válido.
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
  await app.request(
    "/api/auth/sign-up/email",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Teste", username, email, password }),
    },
    env,
  );
  vi.unstubAllGlobals();

  await createDb(env).update(user).set({ emailVerified: true }).where(eq(user.email, email));

  const signInRes = await app.request(
    "/api/auth/sign-in/email",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    },
    env,
  );

  const setCookie = signInRes.headers.get("set-cookie");
  const [cookie] = setCookie?.split(";") ?? [];
  if (!cookie) {
    throw new Error("Falha ao criar usuário de teste: resposta não trouxe Set-Cookie");
  }

  return { cookie, email, username };
}

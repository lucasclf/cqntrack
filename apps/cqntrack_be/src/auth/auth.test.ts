import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../app";
import { createDb } from "../db/client";
import { user, verification } from "../db/schema";

const PASSWORD = "senha12345";

// E-mail/username únicos por chamada: o D1 de teste não isola dados entre `it()`
// do mesmo arquivo, então reaproveitar valores fixos causaria colisão entre testes.
function uniqueUser() {
  const suffix = crypto.randomUUID();
  return {
    name: "Teste",
    // maxUsernameLength é 30 — usa só um pedaço do UUID, não o valor inteiro.
    username: `teste_${suffix.slice(0, 8)}`,
    email: `teste-${suffix}@cqntrack.dev`,
    password: PASSWORD,
  };
}

function extractSessionCookie(res: Response): string {
  const setCookie = res.headers.get("set-cookie");
  const [sessionCookie] = setCookie?.split(";") ?? [];
  if (!sessionCookie) {
    throw new Error("Resposta não trouxe Set-Cookie");
  }
  return sessionCookie;
}

async function signUp(user: { name: string; username: string; email: string; password: string }) {
  return app.request(
    "/api/auth/sign-up/email",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(user),
    },
    env,
  );
}

async function signIn(email: string, password: string) {
  return app.request(
    "/api/auth/sign-in/email",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    },
    env,
  );
}

// Marca o usuário como verificado direto no banco — usado por testes que só
// precisam de um usuário já verificado, sem testar o clique no link em si
// (isso é coberto separadamente no describe "confirmação de e-mail").
async function verifyDirectly(email: string) {
  await createDb(env).update(user).set({ emailVerified: true }).where(eq(user.email, email));
}

// Simula a passagem do tempo sem esperar de verdade — usado pra testar a
// liberação de username de cadastro abandonado (ver hooks.before em
// auth.ts), que decide com base em createdAt.
async function backdateSignup(email: string, minutesAgo: number) {
  await createDb(env)
    .update(user)
    .set({ createdAt: new Date(Date.now() - minutesAgo * 60 * 1000) })
    .where(eq(user.email, email));
}

async function requestPasswordReset(email: string) {
  return app.request(
    "/api/auth/request-password-reset",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, redirectTo: "http://localhost:5173/redefinir-senha" }),
    },
    env,
  );
}

async function resetPassword(newPassword: string, token: string) {
  return app.request(
    "/api/auth/reset-password",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword, token }),
    },
    env,
  );
}

// Captura o corpo mandado pro Resend (client.ts em integrations/resend/) e
// extrai a URL de dentro do HTML do e-mail — testa a integração de ponta a
// ponta, com o token real gerado pelo better-auth, em vez de só simular o
// efeito no banco. Usado tanto pra confirmação de e-mail quanto redefinição
// de senha — mesmo client, mesmo formato de corpo.
function stubResendAndCaptureLinks() {
  const links: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as { to: string; html: string };
      const match = /href="([^"]+)"/.exec(body.html);
      if (match?.[1]) links.push(match[1]);
      return new Response(JSON.stringify({ id: "email-de-teste" }), { status: 200 });
    }),
  );
  return links;
}

// Toda rota de cadastro/login passa por sendVerificationEmail (ver auth.ts),
// que chama o Resend via fetch — sem isso, qualquer signUp() nesse arquivo
// bateria de verdade na internet. Um mock genérico de sucesso é o padrão;
// testes que precisam inspecionar a chamada sobrescrevem com o próprio stub.
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("autenticação", () => {
  it("cadastro com dados válidos cria o usuário, mas não loga (e-mail ainda não verificado)", async () => {
    const testUser = uniqueUser();
    const res = await signUp(testUser);

    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toBeNull();
    await expect(res.json()).resolves.toMatchObject({ token: null });

    const [dbUser] = await createDb(env)
      .select({ emailVerified: user.emailVerified })
      .from(user)
      .where(eq(user.email, testUser.email));
    expect(dbUser?.emailVerified).toBe(false);
  });

  it("cadastro com e-mail já cadastrado devolve resposta genérica (sem revelar que o e-mail existe)", async () => {
    // Proteção anti-enumeração do próprio better-auth, automática quando
    // requireEmailVerification está ligado: em vez de um erro distinguível
    // (que revelaria a um atacante quais e-mails já têm conta), devolve um
    // 200 com token: null idêntico ao de um cadastro novo de verdade — sem
    // criar usuário nenhum nem mandar e-mail.
    const testUser = uniqueUser();
    await signUp(testUser);
    const res = await signUp({ ...testUser, username: `${testUser.username}_2` });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ token: null });

    const usersWithEmail = await createDb(env)
      .select({ username: user.username })
      .from(user)
      .where(eq(user.email, testUser.email));
    expect(usersWithEmail).toEqual([{ username: testUser.username }]);
  });

  it("cadastro com username duplicado falha", async () => {
    const testUser = uniqueUser();
    await signUp(testUser);
    const res = await signUp({ ...testUser, email: `outro-${crypto.randomUUID()}@cqntrack.dev` });

    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("username de cadastro abandonado há mais de 1h10 fica livre pro próximo a pedir", async () => {
    const testUser = uniqueUser();
    await signUp(testUser);
    await backdateSignup(testUser.email, 71);
    const newEmail = `outro-${crypto.randomUUID()}@cqntrack.dev`;

    const res = await signUp({ ...testUser, email: newEmail });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ token: null });

    const db = createDb(env);
    const oldUsers = await db.select().from(user).where(eq(user.email, testUser.email));
    expect(oldUsers).toHaveLength(0);
    const oldVerifications = await db
      .select()
      .from(verification)
      .where(eq(verification.identifier, testUser.email));
    expect(oldVerifications).toHaveLength(0);
    const newUsers = await db.select().from(user).where(eq(user.email, newEmail));
    expect(newUsers).toHaveLength(1);
    expect(newUsers[0]?.username).toBe(testUser.username);
  });

  it("username de cadastro abandonado há menos de 1h10 (dentro da folga) continua bloqueado", async () => {
    const testUser = uniqueUser();
    await signUp(testUser);
    await backdateSignup(testUser.email, 65);

    const res = await signUp({ ...testUser, email: `outro-${crypto.randomUUID()}@cqntrack.dev` });

    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("username de quem já confirmou o e-mail nunca é liberado, mesmo há muito tempo", async () => {
    const testUser = uniqueUser();
    await signUp(testUser);
    await verifyDirectly(testUser.email);
    await backdateSignup(testUser.email, 60 * 24 * 30); // 30 dias

    const res = await signUp({ ...testUser, email: `outro-${crypto.randomUUID()}@cqntrack.dev` });

    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("login antes de verificar o e-mail retorna 403 EMAIL_NOT_VERIFIED", async () => {
    const testUser = uniqueUser();
    await signUp(testUser);
    const res = await signIn(testUser.email, testUser.password);

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({ code: "EMAIL_NOT_VERIFIED" });
  });

  it("login com e-mail já verificado retorna sessão válida", async () => {
    const testUser = uniqueUser();
    await signUp(testUser);
    await verifyDirectly(testUser.email);

    const res = await signIn(testUser.email, testUser.password);

    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("better-auth.session_token=");
  });

  it("login com senha errada falha", async () => {
    const testUser = uniqueUser();
    await signUp(testUser);
    await verifyDirectly(testUser.email);
    const res = await signIn(testUser.email, "senhaerrada");

    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("GET /api/me sem cookie retorna 401", async () => {
    const res = await app.request("/api/me", undefined, env);

    expect(res.status).toBe(401);
  });

  it("GET /api/me com cookie de sessão válido retorna o usuário", async () => {
    const testUser = uniqueUser();
    await signUp(testUser);
    await verifyDirectly(testUser.email);
    const signInRes = await signIn(testUser.email, testUser.password);
    const cookie = extractSessionCookie(signInRes);

    const res = await app.request("/api/me", { headers: { cookie } }, env);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      id: expect.any(String),
      email: testUser.email,
      name: testUser.name,
      username: testUser.username,
      displayUsername: testUser.username,
    });
  });
});

describe("confirmação de e-mail", () => {
  it("cadastro manda e-mail de verificação via Resend com o link certo", async () => {
    const testUser = uniqueUser();
    const links = stubResendAndCaptureLinks();

    await signUp(testUser);

    expect(links).toHaveLength(1);
    expect(links[0]).toContain("/api/auth/verify-email");
    expect(links[0]).toContain("token=");
  });

  it("clicar no link de verificação libera o login, que antes estava bloqueado", async () => {
    const testUser = uniqueUser();
    const links = stubResendAndCaptureLinks();
    await signUp(testUser);
    const verificationUrl = links[0]!;

    const blockedRes = await signIn(testUser.email, testUser.password);
    expect(blockedRes.status).toBe(403);

    const verifyPath = verificationUrl.replace(env.BETTER_AUTH_URL, "");
    const verifyRes = await app.request(verifyPath, undefined, env);
    expect([200, 302]).toContain(verifyRes.status);

    const res = await signIn(testUser.email, testUser.password);
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("better-auth.session_token=");
  });

  it("sendOnSignIn: tentar logar sem verificar reenvia um link novo", async () => {
    const testUser = uniqueUser();
    const links = stubResendAndCaptureLinks();
    await signUp(testUser);
    expect(links).toHaveLength(1);

    await signIn(testUser.email, testUser.password);

    expect(links).toHaveLength(2);
  });

  it("Resend fora do ar não derruba o cadastro — envio roda em segundo plano nesse runtime", async () => {
    // sendVerificationEmail é despachado em background (confirmado
    // empiricamente rodando esse teste, ver comentário em auth.ts) — o
    // cadastro responde 200 e cria a conta normalmente mesmo se o Resend
    // falhar; só não chega e-mail nenhum (fica só como log de erro).
    const testUser = uniqueUser();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("upstream error", { status: 500 })),
    );

    const res = await signUp(testUser);

    expect(res.status).toBe(200);
    const [dbUser] = await createDb(env)
      .select({ emailVerified: user.emailVerified })
      .from(user)
      .where(eq(user.email, testUser.email));
    expect(dbUser?.emailVerified).toBe(false);
  });
});

describe("redefinição de senha", () => {
  it("e-mail inexistente devolve 200 genérico, sem chamar o Resend", async () => {
    const links = stubResendAndCaptureLinks();

    const res = await requestPasswordReset(`inexistente-${crypto.randomUUID()}@cqntrack.dev`);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ status: true });
    expect(links).toHaveLength(0);
  });

  it("e-mail existente manda o link de redefinição via Resend", async () => {
    const testUser = uniqueUser();
    await signUp(testUser);
    const links = stubResendAndCaptureLinks();

    const res = await requestPasswordReset(testUser.email);

    expect(res.status).toBe(200);
    expect(links).toHaveLength(1);
    expect(links[0]).toContain("/api/auth/reset-password/");
  });

  it("clicar no link redireciona com o token anexado na URL final", async () => {
    const testUser = uniqueUser();
    await signUp(testUser);
    const links = stubResendAndCaptureLinks();
    await requestPasswordReset(testUser.email);
    const resetUrl = links[0]!;

    const clickPath = resetUrl.replace(env.BETTER_AUTH_URL, "");
    const res = await app.request(clickPath, { redirect: "manual" }, env);

    expect(res.status).toBe(302);
    const location = res.headers.get("location");
    expect(location).toContain("/redefinir-senha");
    expect(location).toContain("token=");
  });

  it("token válido troca a senha — login com a nova funciona, com a antiga não", async () => {
    const testUser = uniqueUser();
    await signUp(testUser);
    const links = stubResendAndCaptureLinks();
    await requestPasswordReset(testUser.email);
    const resetUrl = links[0]!;
    const token = new URL(resetUrl).pathname.split("/").pop()!;

    const res = await resetPassword("senhaNova456", token);
    expect(res.status).toBe(200);

    await verifyDirectly(testUser.email);
    const oldPasswordRes = await signIn(testUser.email, testUser.password);
    expect(oldPasswordRes.status).toBeGreaterThanOrEqual(400);

    const newPasswordRes = await signIn(testUser.email, "senhaNova456");
    expect(newPasswordRes.status).toBe(200);
  });

  it("token já usado não funciona uma segunda vez", async () => {
    const testUser = uniqueUser();
    await signUp(testUser);
    const links = stubResendAndCaptureLinks();
    await requestPasswordReset(testUser.email);
    const token = new URL(links[0]!).pathname.split("/").pop()!;
    await resetPassword("senhaNova456", token);

    const res = await resetPassword("outraSenha789", token);

    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("token inválido falha", async () => {
    const res = await resetPassword("senhaNova456", "token-que-nao-existe");

    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

// Fica no fim do arquivo de propósito — depois desse teste o contador do
// AUTH_RATE_LIMITER (chave "unknown", já que o ambiente de teste não manda
// CF-Connecting-IP) fica no teto pro resto do arquivo. Nenhum outro teste
// (nem neste arquivo, nem em outro) chama sign-in de novo depois deste.
describe("rate limit de login (AUTH_RATE_LIMITER)", () => {
  it("bloqueia login com 429 depois de passar do limite de tentativas", async () => {
    const testUser = uniqueUser();
    await signUp(testUser);

    // Margem generosa acima do limite configurado (100/60s, ver
    // wrangler.toml): a janela do rate limiter é por tempo, não por
    // execução do teste, então um número justo (tipo 101-105) é frágil —
    // dependendo de quando o teste roda dentro da janela, pode precisar
    // de mais tentativas líquidas pra cruzar o teto de novo.
    let sawRateLimited = false;
    for (let attempt = 0; attempt < 300; attempt++) {
      const res = await signIn(testUser.email, "senhaerrada");
      if (res.status === 429) {
        sawRateLimited = true;
        break;
      }
    }

    expect(sawRateLimited).toBe(true);
  }, 30000);
});

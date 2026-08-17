import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { app } from "../app";

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

describe("autenticação", () => {
  it("cadastro com dados válidos cria sessão", async () => {
    const res = await signUp(uniqueUser());

    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("better-auth.session_token=");
  });

  it("cadastro com e-mail duplicado falha", async () => {
    const user = uniqueUser();
    await signUp(user);
    const res = await signUp({ ...user, username: `${user.username}_2` });

    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("cadastro com username duplicado falha", async () => {
    const user = uniqueUser();
    await signUp(user);
    const res = await signUp({ ...user, email: `outro-${crypto.randomUUID()}@cqntrack.dev` });

    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("login com credenciais corretas retorna sessão válida", async () => {
    const user = uniqueUser();
    await signUp(user);
    const res = await signIn(user.email, user.password);

    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("better-auth.session_token=");
  });

  it("login com senha errada falha", async () => {
    const user = uniqueUser();
    await signUp(user);
    const res = await signIn(user.email, "senhaerrada");

    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("GET /api/me sem cookie retorna 401", async () => {
    const res = await app.request("/api/me", undefined, env);

    expect(res.status).toBe(401);
  });

  it("GET /api/me com cookie de sessão válido retorna o usuário", async () => {
    const user = uniqueUser();
    const signUpRes = await signUp(user);
    const cookie = extractSessionCookie(signUpRes);

    const res = await app.request("/api/me", { headers: { cookie } }, env);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      id: expect.any(String),
      email: user.email,
      name: user.name,
      username: user.username,
      displayUsername: user.username,
    });
  });
});

// Fica no fim do arquivo de propósito — depois desse teste o contador do
// AUTH_RATE_LIMITER (chave "unknown", já que o ambiente de teste não manda
// CF-Connecting-IP) fica no teto pro resto do arquivo. Nenhum outro teste
// (nem neste arquivo, nem em outro) chama sign-in de novo depois deste.
describe("rate limit de login (AUTH_RATE_LIMITER)", () => {
  it("bloqueia login com 429 depois de passar do limite de tentativas", async () => {
    const user = uniqueUser();
    await signUp(user);

    // Margem generosa acima do limite configurado (100/60s, ver
    // wrangler.toml): a janela do rate limiter é por tempo, não por
    // execução do teste, então um número justo (tipo 101-105) é frágil —
    // dependendo de quando o teste roda dentro da janela, pode precisar
    // de mais tentativas líquidas pra cruzar o teto de novo.
    let sawRateLimited = false;
    for (let attempt = 0; attempt < 300; attempt++) {
      const res = await signIn(user.email, "senhaerrada");
      if (res.status === 429) {
        sawRateLimited = true;
        break;
      }
    }

    expect(sawRateLimited).toBe(true);
  }, 30000);
});

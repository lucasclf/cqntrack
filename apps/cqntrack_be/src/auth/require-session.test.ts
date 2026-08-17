import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { createAuthenticatedUser } from "../../test/auth-helpers";
import { app } from "../app";

// Usa /api/me (rota mais barata que existe atrás de requireSession) só pra
// exercitar o rate limit em si — não o conteúdo da resposta.
describe("API_RATE_LIMITER (rotas autenticadas)", () => {
  it("bloqueia com 429 depois de passar do limite de requests do usuário", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);

    // Margem generosa acima do limite configurado (180/60s, ver
    // wrangler.toml) — mesmo motivo do teste equivalente em auth.test.ts:
    // a janela é por tempo, não por execução do teste.
    let sawRateLimited = false;
    for (let attempt = 0; attempt < 400; attempt++) {
      const res = await app.request("/api/me", { headers: { cookie } }, env);
      if (res.status === 429) {
        sawRateLimited = true;
        break;
      }
      expect(res.status).toBe(200);
    }

    expect(sawRateLimited).toBe(true);
  }, 15000);

  it("usuários diferentes têm contadores independentes", async () => {
    const userA = await createAuthenticatedUser(app, env);
    const userB = await createAuthenticatedUser(app, env);

    // Esgota o limite só do usuário A.
    for (let attempt = 0; attempt < 400; attempt++) {
      const res = await app.request("/api/me", { headers: { cookie: userA.cookie } }, env);
      if (res.status === 429) break;
    }

    const resB = await app.request("/api/me", { headers: { cookie: userB.cookie } }, env);
    expect(resB.status).toBe(200);
  }, 15000);
});

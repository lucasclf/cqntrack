---
name: browser-smoke-test
description: Testa manualmente uma feature web do cqntrack num browser headless de verdade (Playwright), com uma sessão de usuário autenticada — não só typecheck/testes automatizados. Use antes de considerar qualquer feature de UI nova ou alterada como "pronta", especialmente quando ela consome uma API externa real (MangaDex, TMDB, Google Books, IGDB) que vale a pena testar sem mock.
---

# Teste manual em browser real (Playwright)

`chromium-cli` não está disponível neste ambiente Windows — use um driver Playwright próprio
(pacote já instalado localmente em sessões anteriores; se não estiver, `npm install playwright` no
scratchpad, os browsers já ficam cacheados em `~/AppData/Local/ms-playwright`). Use
`template.mjs` deste diretório como ponto de partida em vez de escrever o driver do zero.

## Pré-requisito

Backend + frontend locais de pé — skill `dev-servers`. Confirme `curl localhost:8787/api/health`
antes de continuar (não `127.0.0.1`, ver gotcha de IPv6 na skill `dev-servers`).

## 1. Criar um usuário de teste autenticado contra o servidor local

Diferente do helper `createAuthenticatedUser` (que só funciona dentro do vitest/miniflare), testar
via browser real exige um usuário de verdade no D1 local, criado via HTTP contra o `wrangler dev`
rodando:

```bash
# 1. Signup (cria o usuário, sessão ainda não é criada por email não verificado)
curl -s -c cookies.txt -X POST http://localhost:8787/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{"name":"Teste Smoke","username":"smoketest","email":"smoketest@cqntrack.dev","password":"senha12345"}'

# 2. Marcar email como verificado direto no D1 local (coluna real: email_verified, integer boolean)
cd apps/cqntrack_be && npx wrangler d1 execute cqntrack-db --local \
  --command "UPDATE user SET email_verified = 1 WHERE email = 'smoketest@cqntrack.dev'"

# 3. Sign-in — a resposta traz o Set-Cookie com o session_token real
curl -s -i -X POST http://localhost:8787/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{"email":"smoketest@cqntrack.dev","password":"senha12345"}'
```

Extraia o valor de `better-auth.session_token` do header `Set-Cookie` da resposta do passo 3
(URL-decode o valor — `template.mjs` já faz isso via `decodeURIComponent`).

## 2. Rodar o driver

```bash
node template.mjs <session_token_decodificado>
```

O template já cobre: injeção do cookie via `context.addCookies()` (bypassa a UI de login),
captura de `console.error`/`pageerror` em todas as páginas visitadas, screenshots full-page em cada
etapa (salvos no scratchpad da sessão). **Adapte** a lista de passos (`page.goto`, seletores,
ações) para a feature específica sendo testada — o boilerplate de setup é reutilizável, o roteiro
de navegação não é.

## 3. Sempre conferir antes de reportar sucesso

- **Screenshots** — olhe de fato o PNG gerado (via Read), não só o texto do console. Uma tela em
  branco ou um esqueleto sem dado é falha de carregar, não sucesso.
- **`console --errors`** (aqui: o array `consoleErrors` impresso no fim do script) — uma página pode
  renderizar a casca inteira enquanto toda chamada de API por trás retorna 500.
- Teste contra a **API externa real**, não mockada — é o único jeito de pegar bug de shape de
  resposta que o mock não reproduziria (foi assim que o bug do `chapter: "none"` da MangaDex foi
  encontrado: um oneshot real sem numeração de capítulo, que nenhum mock teria criado).

## Gotchas conhecidos

- `page.locator("a").filter({ hasText: "X" })` sem `.first()`/seletor mais específico pode casar um
  item errado que contém o texto como substring (ex.: "Death Note" casando dentro de "JoJo x Death
  Note (Doujinshi)"). Prefira navegar direto para uma URL/ID conhecido quando o teste depender de
  um item específico.
- Inputs controlados por React: `eval el.value = '...'` não dispara `onChange`. Use
  `page.fill()`/`page.type()`, que passam pelo pipeline de input de verdade do Playwright.
- Long-poll/websocket: `waitForLoadState("networkidle")` pode nunca resolver — prefira
  `waitForSelector` do elemento que a tela realmente precisa mostrar.

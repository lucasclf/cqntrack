# cqntrack — Instruções para o Agent

## Visão geral do projeto

cqntrack é um sistema pessoal para registrar jogos, séries, filmes e livros consumidos. Cada seção (mídia) consome uma API externa diferente para buscar catálogo. A primeira seção a ser implementada é a de **jogos**, usando a **IGDB API**. Roda inteiramente no ambiente Cloudflare (Workers, D1, Pages/Assets).

## Stack técnica

- **Frontend:** React
- **Backend:** Hono, rodando em Cloudflare Workers
- **Banco:** Cloudflare D1 + Drizzle ORM
- **Autenticação:** better-auth, integrado ao Hono, sessão persistida no D1
- **Package manager:** pnpm (workspaces nativo, sem Turborepo por enquanto)
- **Testes:** Vitest
- **Lint/Format:** ESLint + Prettier
- **Deploy:** Wrangler, apenas ambiente de produção por enquanto (sem dev/staging separados)

## Estrutura do repositório (monorepo)

```
cqntrack/
  apps/
    cqntrack_be/          # Worker (Hono) + Drizzle + D1 + better-auth
      src/
        integrations/     # 1 client isolado por API externa (ex: igdb/)
    cqntrack_fe/           # React app
    cqntrack_mobile/        # Empacota o cqntrack_fe via Capacitor (app Android)
  packages/
    shared/                # Schemas Zod e tipos compartilhados entre BE e FE
  pnpm-workspace.yaml
  package.json
  CLAUDE.md
```

## Convenções de código

- Identificadores (variáveis, funções, classes, arquivos) em **inglês**
- Comentários e documentação em **português (PT-BR)**
- TypeScript em todo o projeto; evitar `any` sem justificativa comentada
- Contratos de API (request/response) definidos como **schemas Zod** em `packages/shared`, com os tipos TS inferidos a partir deles (`z.infer`)
- **Nunca** compartilhar entities do Drizzle (modelos de banco) diretamente com o frontend — sempre mapear para DTO antes de expor

## Autenticação

- better-auth cuida de sessão/login
- Rotas que alteram dado do usuário (marcar item como consumido, criar/editar lista, favoritar, etc.) exigem sessão válida
- **Exceção deliberada:** o perfil público (`/@:username` e as rotas `/api/users/:username/*`) expõe marcações, favoritos, listas, review e nota pessoal **sem exigir sessão** — é a proposta do perfil público (no espírito de Letterboxd/Trakt: qualquer um pode ver o que o dono do perfil consumiu, avaliou e escreveu). Não é uma lacuna a corrigir; é o comportamento esperado dessas rotas especificamente.

## Integração com APIs externas

- Seção de jogos consome a **IGDB API** (requer client id/secret da Twitch)
- Credenciais de API **nunca** vão em arquivo versionado — usar `wrangler secret put`
- Cada nova seção (séries, filmes, livros) deve ter seu client de API isolado em `apps/cqntrack_be/src/integrations/<nome>/`, seguindo o mesmo padrão da integração com a IGDB

## App mobile (Android)

- `apps/cqntrack_mobile` empacota o `apps/cqntrack_fe` via Capacitor — mesmo código-fonte, um segundo alvo de build (`vite build --mode mobile`, ver `vite.config.ts` do FE). Não é um app nativo/React Native separado.
- **Ordem expressa: toda alteração feita no frontend web deve ser refletida no app mobile.** Como os dois builds compartilham os mesmos componentes React, a maior parte das mudanças já chega ao mobile automaticamente — a obrigação aqui é de vigilância, não de reimplementação: ao terminar uma tarefa no FE, conferir se ela também se aplica ao build mobile (rebuildar `dist-mobile` e checar) antes de considerar a tarefa concluída. Não deixar o mobile ficar defasado silenciosamente.
- **Exceção deliberada:** funcionalidades de importação de dados de outras redes sociais/apps (hoje: Filmow, tvtime, via CSV) ficam de fora do build mobile de propósito (`import.meta.env.VITE_TARGET !== "mobile"`, ver `Account.tsx`). Não é uma lacuna a corrigir — é o único tipo de funcionalidade que pode divergir entre web e mobile sem ser considerado um bug.

## Testes

- Vitest para testes unitários e de integração em `cqntrack_be` e `cqntrack_fe`
- Rodar `pnpm test` antes de considerar qualquer tarefa concluída

## Lint e formatação

- ESLint + Prettier configurados na raiz do monorepo, aplicados a todos os workspaces
- Rodar `pnpm lint` e `pnpm format` antes de commit

## Git / Commits

- **Conventional Commits**: `feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`
- Mensagens claras e objetivas
- **Sempre avisar** proativamente quando identificar um bom momento para commit (ex.: mudança coesa, testada e completa) — o aviso não substitui a confirmação explícita exigida antes de efetivamente commitar

## Deploy

- Só produção por enquanto — um Worker, um D1, um Pages/Assets
- Deploy via Wrangler (`wrangler deploy` no BE; Pages ou Workers Assets no FE)
- Segredos (IGDB client id/secret, chaves do better-auth) via `wrangler secret put`

## Autonomia do agent

- **Pode rodar livremente:** build, lint, format, testes
- **Deve pedir confirmação antes de:** instalar novas dependências, criar ou alterar migrations do banco, dar commit ou push, fazer deploy
- Ao alterar um contrato de API (schemas em `packages/shared`), avisar explicitamente quais consumidores (BE e/ou FE) foram impactados pela mudança

## Notas gerais

- Projeto pessoal e solo — priorizar simplicidade sobre generalização prematura
- Novas seções de mídia (séries, filmes, livros) devem replicar o padrão da seção de jogos: schema compartilhado em `packages/shared` + client de integração isolado no BE + rotas dedicadas
- Todas as respostas de prompts devem ser escritas em português do brasil, apesar do código inglês.

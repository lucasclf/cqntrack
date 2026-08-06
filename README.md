# cqntrack

Sistema pessoal para registrar jogos, séries, filmes e livros consumidos. Roda inteiramente no
ambiente Cloudflare (Workers, D1, Pages/Assets). A primeira seção implementada é a de jogos.

## Estrutura

```
cqntrack/
  apps/
    cqntrack_be/     # Worker (Hono), API em apps/cqntrack_be/src
    cqntrack_fe/      # App React (Vite)
  packages/
    shared/           # Schemas Zod e tipos compartilhados entre BE e FE
```

## Requisitos

- Node.js >= 22
- pnpm (recomendado via `corepack enable`)

## Como rodar

Instalar as dependências do monorepo:

```sh
pnpm install
```

Subir backend e frontend em modo desenvolvimento (backend em `localhost:8787`, frontend em
`localhost:5173` com proxy de `/api` para o backend):

```sh
pnpm dev
```

Rodar os testes de todos os workspaces:

```sh
pnpm test
```

Rodar o lint (ESLint) em todo o repositório:

```sh
pnpm lint
```

Formatar o código (Prettier):

```sh
pnpm format
```

## Status atual

Esta etapa cobre apenas o esqueleto do monorepo: workspaces configurados, endpoint de exemplo
(`GET /api/health`) no backend consumido pela tela inicial do frontend, e um schema Zod
compartilhado (`HealthResponseSchema`) validando o contrato entre as duas pontas. Banco de dados
(D1/Drizzle), autenticação (better-auth) e integrações com APIs externas (ex.: IGDB) ainda não
foram implementados.

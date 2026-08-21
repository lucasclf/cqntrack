---
name: d1-migration
description: Workflow seguro para criar e aplicar migrations do Drizzle/D1 no cqntrack (schema novo/alterado, geração via drizzle-kit, apply local vs. remoto). Use sempre que uma tabela/coluna precisar mudar em apps/cqntrack_be/src/db/schema/ — inclusive como parte de uma nova seção de mídia.
---

# Migrations D1 (Drizzle) no cqntrack

O CLAUDE.md do projeto exige confirmação explícita do usuário antes de **criar ou alterar
migrations** — isso cobre tanto gerar quanto aplicar, local ou remoto. Nunca pule essa confirmação
mesmo que o resto da tarefa já tenha sido aprovado (ex.: "pode implementar a feature X" não é
autorização implícita para mexer no schema).

## 1. Editar o schema

Schema Drizzle vive em `apps/cqntrack_be/src/db/schema/<área>.schema.ts`, registrado via
`export * from "./<área>.schema"` em `apps/cqntrack_be/src/db/schema/index.ts`.

**Gotcha — sentinela em vez de `NULL` em unique index:** SQLite trata cada `NULL` como distinto
dentro de um índice único, então uma coluna nullable numa unique constraint não bloqueia
duplicatas. Se o domínio tem um "sem valor" legítimo (ex.: capítulo de mangá sem número, volume não
atribuído), use um valor sentinela numérico real fora do range válido em vez de `null` — ver
`apps/cqntrack_be/src/db/schema/manga.schema.ts` (`volumeNumber: 0`, `chapterNumber: -1`) e o
comentário em `apps/cqntrack_be/src/manga/chapters.service.ts` sobre por que `-1` e não `0`.

## 2. Gerar a migration — **pedir confirmação antes**

```bash
cd "g:/projetos/cqntrack/apps/cqntrack_be" && pnpm run db:generate
```

Isso roda `drizzle-kit generate` e cria `drizzle/NNNN_<nome-aleatorio>.sql` +
`drizzle/meta/NNNN_snapshot.json`, e atualiza `drizzle/meta/_journal.json`. **Leia o SQL gerado**
antes de aplicar — confirme que é só `CREATE TABLE`/`CREATE INDEX` (aditivo) ou, se for
`ALTER`/`DROP`, entenda o impacto em dado existente antes de prosseguir.

## 3. Aplicar local — **pedir confirmação antes**

```bash
pnpm run db:migrate:local
```

Aplica no D1 local (SQLite em `.wrangler/state/v3/d1/`, usado pelo `wrangler dev` e pelos testes).
Seguro e reversível (é só apagar o arquivo local e reaplicar do zero, se necessário).

## 4. Aplicar remoto (produção) — **pedir confirmação separada, mesmo que local já tenha sido aprovado**

```bash
pnpm run db:migrate:remote
```

Isso é `wrangler d1 migrations apply cqntrack-db --remote`, roda contra o D1 de produção de
verdade. Trate como uma ação irreversível de banco em produção mesmo quando a migration é
puramente aditiva:

- Antes de rodar, resuma para o usuário **o que a migration faz** (tabelas/colunas novas, se é
  aditivo ou destrutivo) e peça confirmação explícita — não assuma que "pode deployar" já cobre
  isso.
- Se o comando falhar com `The given account is not valid or is not authorized to access this
service [code: 7403]`, é um erro transitório da API do Cloudflare, não um problema de
  autenticação real — confirme com `npx wrangler whoami` (deve mostrar o token OAuth válido) e
  tente rodar o mesmo comando de novo antes de investigar mais a fundo.
- O deploy do Worker (`wrangler deploy`) **não roda migrations automaticamente** — se uma feature
  nova depende de tabela nova, o código pode subir para produção antes do banco estar pronto,
  quebrando em runtime (`no such table`) até a migration remota ser aplicada. Ao deployar uma
  feature com schema novo, aplique a migration remota **antes** do `wrangler deploy`, não depois.

## Outros gotchas de D1 relevantes ao escrever queries

- **Limite de parâmetros ligados por statement (~100)**: em imports batch (Filmow/tvtime/Cinopsys),
  inserts grandes são fatiados em chunks — ver `INSERT_CHUNK_SIZE` em
  `apps/cqntrack_be/src/series/import.service.ts`. Replique esse padrão (`chunk(rows, N)`) para
  qualquer insert em lote de tamanho não limitado.
- **CPU de 10ms por request (Free tier)**: nenhuma migration ou query deve depender de processar
  volume grande numa única invocação — é o mesmo motivo por trás do parsing client-side + POST
  batelado nos imports.

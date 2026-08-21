---
name: new-media-section
description: Scaffold completo de uma nova seção de mídia no cqntrack (backend + frontend), replicando o padrão já usado em jogos/IGDB, séries/filmes/TMDB, livros/Google Books e mangás/MangaDex. Use quando o usuário pedir uma seção nova (ex. "quero adicionar música", "vamos fazer uma seção de board games") ou uma feature grande que segue esse mesmo formato de cache-global + marcação pessoal + listas.
---

# Nova seção de mídia (cache global + entry + listas)

cqntrack tem 5 seções de mídia hoje (jogos, séries, filmes, livros, mangás), todas seguindo
**exatamente o mesmo esqueleto**: um client de API externa isolado, uma tabela de cache global do
item, uma tabela de marcação pessoal do usuário, listas custom, e rotas espelhadas em
`/api/<seção>` + `/api/<seção>-lists`. Uma seção nova é trabalho de **réplica adaptada**, não de
design do zero — a maior parte das decisões já foi tomada nas seções anteriores.

O caso mais recente e mais completo para copiar é **mangás** (`git show <commit-da-seção-de-mangas>
--stat`, ou leia os arquivos diretamente): tem cache global + marcação + progresso granular
(capítulo/volume) + listas + Discover, e documenta no código as decisões e armadilhas mais
recentes. Livros é o exemplo mais simples (sem substrutura tipo capítulo/episódio) se a seção nova
for só "item único, sem progresso interno".

## 0. Antes de codar — decisões a alinhar com o usuário

Não assuma; pergunte quando não for óbvio pelo pedido do usuário:

1. **Qual API externa é o catálogo?** Precisa ser pública ou de autenticação simples (API key) —
   nunca proponha algo que exija OAuth de usuário final para "importar dados pessoais de uma conta
   externa" sem checar antes (foi exatamente isso que inviabilizou a integração com o Trakt: exige
   conta paga para criar app OAuth). Se a API tiver um modo catálogo público E um modo
   OAuth/sincronização pessoal, confirme explicitamente com o usuário que o objetivo é só o
   catálogo (como foi feito para MangaDex).
2. **A seção tem substrutura?** (temporada/episódio de série, volume/capítulo de mangá) — se sim,
   ela precisa de uma tabela de progresso granular + serviço dedicado (`chapters.service.ts`,
   `episodes.service.ts`) e a estrutura NÃO deve ser cacheada localmente (busca ao vivo na API
   externa toda vez que a tela abre — ver decisão de arquitetura abaixo).
3. **Tem "Descobrir" (popularidade real)?** Só faz sentido se a API tiver um endpoint de
   ranking/popularidade de verdade (MangaDex e TMDB têm; Google Books não tem, por isso livros não
   tem Discover). Não fabrique um "Descobrir" com dado que não é popularidade real.
4. **Qual o vocabulário de status de leitura/consumo?** Binário (visto/não visto, como filme),
   5-estados (como jogo), ou 4-estados tipo livro/mangá (`want_to/queria`, `reading/lendo`,
   `read/lido`, `dropped/abandonado`)? Escolha o que já existe mais parecido — não invente um
   quinto vocabulário sem necessidade.

## 1. Ordem de execução

Siga essa ordem — cada etapa depende da anterior, e rodar fora de ordem gera retrabalho:

### 1. Contrato Zod (`packages/shared/src/<seção>.ts`)

Copie a estrutura de `packages/shared/src/manga.ts` ou `books.ts`. Padrão de nomes:
`<Seção>_STATUSES`, `<Seção>StatusSchema`, `<Seção>SummarySchema` (resultado de busca — leve),
`<Seção>DetailSchema` (tela de detalhe — completo), `<Seção>EntrySchema`, `SearchQuerySchema` /
`SearchResponseSchema`, `Upsert<Seção>EntryRequestSchema`, `<Seção>ListSchema`s (create/update/
detail). Exporte tudo em `packages/shared/src/index.ts`.

### 2. Schema Drizzle (`apps/cqntrack_be/src/db/schema/<seção>.schema.ts`)

Copie a estrutura de `manga.schema.ts`: tabela de cache global (PK = id externo, tipo texto ou
inteiro conforme a API), `<seção>Entry` (unique `userId+itemId`), `<seção>List`/`<seção>ListItem`
(cópia estrutural de `bookList`/`bookListItem`), e se houver substrutura, a tabela de progresso
granular (unique composto, ver gotcha de sentinela na skill `d1-migration`). Registre em
`db/schema/index.ts`.

Gere e aplique a migration usando a skill `d1-migration` — **pedir confirmação antes de gerar e
antes de aplicar**, inclusive local.

### 3. Client de integração (`apps/cqntrack_be/src/integrations/<api>/`)

Isolado, **fora** de `<seção>/` — mesmo padrão de `igdb/`, `tmdb/`, `googlebooks/`, `mangadex/`.
`client.ts` faz o fetch cru (headers obrigatórios como `User-Agent`, key se houver — nunca em
arquivo versionado, usar `wrangler secret put` e avisar o usuário antes) e converte erro não-2xx em
uma `<Api>RequestError` própria. Arquivos de recurso (`<seção>.ts`, talvez `author.ts`/`person.ts`)
retornam **o shape cru da API externa**, sem mapear para DTO — o mapeamento pertence à camada de
serviço (`<seção>.service.ts`), não à integração. (Isso já foi errado uma vez na sessão de mangás —
mapear cedo demais na integração — e corrigido depois; comece já certo.)

Antes de escrever o client, valide os endpoints reais via `curl`/`WebFetch` contra a API de
verdade: paginação, rate limit, se precisa de `User-Agent`, formato exato da resposta (nomes de
campo mudam entre docs e resposta real). Não confie só na documentação.

### 4. Services (`apps/cqntrack_be/src/<seção>/`)

- `<seção>.service.ts`: `getOrCache<Seção>(db, id)` — cache-or-fetch, devolve cache velho se a API
  externa falhar. `isStale()` **só por tempo** (comparar `updatedAt` contra um TTL), a menos que a
  seção precise buscar "créditos"/dado secundário separado do fetch principal — nesse caso, CUIDADO
  com a armadilha de filme/série: `isStale = cast === null || tempo > TTL` faz o cache nunca ficar
  "fresco" quando o fetch original rodou com `fetchCredits: false` (como em todo import), porque
  `cast` fica `null` para sempre e todo re-acesso reconsulta a API externa à toa. Mangás evitou essa
  armadilha de propósito não tendo um fetch secundário — prefira esse desenho se possível.
- `entries.service.ts`: `ensure<Seção>Entry` (cria linha bare antes de gravar progresso, para o item
  aparecer em "Minhas marcações" mesmo sem status explícito), `upsert<Seção>Entry`,
  `get<Seção>EntryForUser`, `list<Seção>Entries` (paginado), `getFavorites`.
- Se houver substrutura: `<progresso>.service.ts` (`chapters.service.ts`/`episodes.service.ts`) —
  busca a estrutura **ao vivo** na API externa (sem cache local — ver decisão de arquitetura
  abaixo), marca progresso via `onConflictDoNothing()`/delete (existência da linha = "consumido",
  sem coluna boolean).
- `lists.service.ts`: cópia estrutural de `books/lists.service.ts`.

**Decisão de arquitetura — por que a estrutura de progresso NÃO é cacheada:** buscar e cachear
"todos os capítulos/episódios de todo item" custaria uma chamada extra por item só para popular uma
tela de busca com 20 resultados, e ficaria desatualizado toda vez que a obra em lançamento ganhasse
capítulo novo. Em vez disso, a lista completa é buscada ao vivo só quando o usuário abre o detalhe
do item — e nesse ponto a MangaDex, por exemplo, devolve tudo numa chamada só (`/aggregate`),
diferente de série (TMDB exige uma chamada por temporada). Confira o que a API da nova seção
permite antes de decidir se cabe "tudo de uma vez" ou "por aba/página".

### 5. Rotas (`<seção>/<seção>.routes.ts`, `<seção>/lists.routes.ts`)

Monte em `/api/<seção>` e `/api/<seção>-lists`, registre em `apps/cqntrack_be/src/app.ts`.
**Rotas estáticas antes da dinâmica**: `/search`, `/discover`, `/entries`, `/favorites` precisam vir
registradas antes de `/:id`, senão o Hono casa `/search` como se fosse um `:id` literal.

Rotas de perfil público (`apps/cqntrack_be/src/users/users.routes.ts`) — adicione
`/:username/<seção>/entries`, `/<seção>/favorites`, `/<seção>/lists`, `/<seção>/lists/:listId`,
**sem `requireSession`** (perfil público é a exceção deliberada documentada no CLAUDE.md).

### 6. Testes de backend

Espelhe `manga.routes.test.ts`/`books.routes.test.ts`: mock de `fetch` para a API externa
(`vi.stubGlobal`/`stubFetchByUrl` — usar `stubFetchByUrl` em vez de mocks FIFO sempre que o teste
tiver chamadas concorrentes, para não gerar flakiness de ordem), `createAuthenticatedUser` para
sessão de teste, um teste de regressão para cada bug real encontrado durante teste manual.

### 7. Frontend (`apps/cqntrack_fe/src/<seção>/`)

Réplica adaptada de `books/` (item único) ou `series/` (com substrutura), trocando vocabulário.
Componentes de apoio a copiar 1:1 mudando só o texto/tipo: `<Seção>Card`, `<Seção>StatusBadge`,
`<Seção>Search` (debounce 300ms), `<Seção>Detail`, `AddTo<Seção>ListMenu`, `Add<Seção>Search`,
`<Seção>EntryFilters`, `<Seção>FavoritesSection`, `My<Seção>Entries`, `My<Seção>Lists`,
`<Seção>ListDetail`. Se houver Discover real (passo 0.3), `<Seção>Discover.tsx`. Reaproveitados sem
alteração: `usePaginatedEntries`, `useInfiniteScrollSentinel`, `apiClient`, `StarRating`,
`ListFormModal`.

`profile/<Seção>TabPanel.tsx`, `profile/<Seção>Stats.tsx`, `profile/RecentlyRead<Seção>.tsx` — cópia
de `BookTabPanel`/`BookStats`/`RecentlyReadBooks`.

### 8. Registro de navegação

- `packages/shared/src/media-type.ts`: adicionar em `MEDIA_TYPES`, `MEDIA_TYPE_LABELS`,
  `MEDIA_TYPE_PATH`, `IMPLEMENTED_MEDIA_TYPES` — sozinho isso já cobre o item no menu (`TopBar.tsx`
  itera a lista, nada hardcoded por seção).
- `apps/cqntrack_fe/src/router.tsx`: bloco de rotas autenticadas (índice/Discover, `/buscar`,
  `/:id`, `/marcacoes`, `/listas`, `/listas/:listId`, autor/pessoa se aplicável) + filho da rota de
  perfil público (`/:handle/<seção>`).
- `apps/cqntrack_fe/src/Home.tsx` / `HomeTabs.tsx`: bloco + tipo da aba nova.
- `apps/cqntrack_fe/src/profile/ProfileTabs.tsx` / `PublicProfile.tsx`: idem para o perfil público.

## Checklist final antes de considerar pronto

- [ ] `pnpm --filter @cqntrack/backend typecheck && pnpm --filter @cqntrack/backend test`
- [ ] `pnpm --filter @cqntrack/frontend typecheck && pnpm --filter @cqntrack/frontend test`
- [ ] `pnpm lint` na raiz
- [ ] Teste manual em browser de ponta a ponta (skill `browser-smoke-test`) contra a API externa
      real, não mockada — busca, detalhe, marcar status/nota/favorito, progresso granular se
      houver, aba na Home, aba no perfil público sem sessão
- [ ] Rebuild mobile (`pnpm --filter @cqntrack/frontend run build:mobile`) e confirmar que a seção
      nova aparece — **exceto** se for uma feature de import de dado de rede social externa (essas
      ficam de fora do mobile de propósito, ver `VITE_TARGET` em `Account.tsx`)
- [ ] Se schema mudou: migration aplicada local (skill `d1-migration`); aplicar em produção fica
      para o momento do deploy, com confirmação separada

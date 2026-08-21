---
name: mobile-api-contract
description: Gera um resumo conciso e atualizado do contrato de API REST do backend cqntrack (endpoints, shapes Zod, fluxo de auth) pensado como referência para o app Android nativo em Kotlin que vai substituir o wrapper Capacitor atual. Use no início da migração para Kotlin, ou sempre que uma seção nova/alterada no backend precisar ser refletida no app nativo e for útil ter o contrato inteiro num lugar só em vez de reler todo o TypeScript.
---

# Contrato de API para o app nativo (Kotlin)

O plano é substituir `apps/cqntrack_mobile` (hoje um wrapper Capacitor que só espelha o frontend
web numa WebView) por um app Android nativo em Kotlin, mais robusto que um espelho — não outro
WebView, uma UI própria consumindo a mesma API. Essa skill não builda nada Kotlin (o projeto nativo
ainda não existe) — ela prepara o material que evita reler o backend inteiro em TypeScript toda vez
que uma tela nova do app precisa saber "que endpoint chamar e com que shape".

## O que reunir

Backend é Hono + Zod, então o contrato inteiro já está declarado de forma exata em dois lugares:

1. **`packages/shared/src/*.ts`** — todo `z.object`/`z.enum` exportado é o shape exato de
   request/response de algum endpoint. Não precisa reimplementar em Kotlin data classes a mão sem
   conferir aqui primeiro.
2. **`apps/cqntrack_be/src/app.ts`** + `apps/cqntrack_be/src/<área>/*.routes.ts`** — toda rota
   montada, incluindo quais exigem `requireSession` e quais são públicas (perfil público:
   `/api/users/:username/*`, sem sessão, de propósito).

## Como montar o resumo

Ao ser invocada, esta skill deve:

1. Listar todas as rotas registradas em `app.ts` e em cada `<área>/<área>.routes.ts` /
   `<área>/lists.routes.ts` (método + path + se exige sessão).
2. Para cada rota, localizar o schema Zod de request/response correspondente em
   `packages/shared/src/*.ts` e resumir o shape (nome dos campos + tipo — não precisa colar o
   `z.object` inteiro, só a forma).
3. Documentar o fluxo de auth — **já resolvido no backend para exatamente este cenário, não é
   trabalho novo**: o app web usa cookie de sessão, mas `apps/cqntrack_be/src/auth/auth.ts` já
   registra o plugin `bearer()` do better-auth por causa do WebView do Capacitor (que não consegue
   usar o cookie `Domain=.cqn.xyz.br`, já que serve conteúdo a partir de `https://localhost`) — o
   mesmo mecanismo serve um cliente nativo Kotlin sem nenhuma mudança de backend:
   - Login/cadastro (`POST /api/auth/sign-in/email`, `/sign-up/email`) devolve o token no header de
     resposta `set-auth-token`.
   - Toda chamada autenticada subsequente manda `Authorization: Bearer <token>` — sem cookie, sem
     `CookieJar` no cliente HTTP.
   - Guardar o token em storage seguro real (`EncryptedSharedPreferences`/Android Keystore via
     `androidx.security.crypto`, ou `DataStore` + Tink) — **não** replicar o `Capacitor Preferences`
     usado hoje pelo app web-mobile (`mobile-token-storage.ts`), que é só `SharedPreferences` sem
     criptografia; um app nativo de verdade deve fazer melhor que isso.
   - **Ponto de atenção real**: `trustedOrigins` do better-auth valida o header `Origin` nas rotas
     `/api/auth/*` no servidor (independente do CORS do browser) — hoje aceita
     `FRONTEND_ORIGIN`/`MOBILE_APP_ORIGIN` (`https://localhost`, o que o WebView do Capacitor
     reporta). Um cliente HTTP nativo (OkHttp/Ktor) não manda `Origin` por padrão — ou define esse
     header manualmente nas chamadas de auth batendo com um dos origins confiáveis, ou pede uma
     entrada nova em `trustedOrigins`/`MOBILE_APP_ORIGIN` para o app nativo. Confirmar contra o
     backend rodando local antes de assumir qualquer um dos dois caminhos.
4. Apontar as decisões de UX/domínio já tomadas no web que o app nativo precisa replicar (não
   redescobrir): vocabulário de status por seção (binário/5-estados/4-estados — ver skill
   `new-media-section` passo 0.4), paginação por scroll infinito (`usePaginatedEntries`), regra de
   "perfil público sem sessão", sentinelas de progresso granular (capítulo/volume "none" na
   MangaDex, ver `chapters.service.ts`).
5. Salvar o resultado como um arquivo de referência (ex. `docs/mobile-api-contract.md` ou no
   scratchpad, conforme o usuário preferir) — não é para virar mais um arquivo perdido em memória
   de conversa, é para o próximo trabalho na migração Kotlin (nesta sessão ou numa futura) começar
   lendo esse arquivo em vez de todo `packages/shared/`.

## Quando re-rodar

Sempre que uma seção de mídia nova for adicionada (skill `new-media-section`) ou um contrato
existente mudar — o resumo desatualiza rápido, não é para ficar estático. Se o arquivo de saída já
existir, regenere/atualize em vez de duplicar.

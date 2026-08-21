---
name: dev-servers
description: Sobe backend (wrangler dev) e frontend (vite dev) locais do cqntrack para teste manual/depuração. Use sempre que precisar rodar a aplicação de verdade (não só os testes automatizados) — antes de um browser-smoke-test, para reproduzir um bug relatado, ou para testar uma feature nova na UI antes de considerá-la pronta.
---

# Subir backend + frontend locais (cqntrack)

Backend (Hono/Workers) roda via `wrangler dev` na porta **8787**; frontend (Vite) roda na porta
**5173** e faz proxy de `/api` para `localhost:8787` (`apps/cqntrack_fe/vite.config.ts`). Os dois
precisam estar de pé ao mesmo tempo para testar a app de ponta a ponta.

## Subir

```bash
cd "g:/projetos/cqntrack/apps/cqntrack_be" && pnpm run dev   # porta 8787, background
cd "g:/projetos/cqntrack/apps/cqntrack_fe" && pnpm run dev   # porta 5173, background
```

Rode os dois com `run_in_background: true`. Não use `sleep` fixo para esperar — faça polling do
health check:

```bash
timeout 45 bash -c 'until curl -sf http://localhost:8787/api/health >/dev/null 2>&1; do sleep 1; done'
timeout 45 bash -c 'until curl -sf http://localhost:5173 >/dev/null 2>&1; do sleep 1; done'
```

**Importante:** teste o backend com `localhost:8787`, nunca `127.0.0.1:8787`. O Vite v8 (e às vezes
o próprio wrangler) faz bind em `::1` (IPv6), não em `127.0.0.1` — `curl 127.0.0.1` dá "connection
refused" mesmo com o servidor de pé e saudável.

## Gotcha: porta "presa" (Windows)

`wrangler dev` sobe um processo filho `workerd.exe` separado do wrapper Node — matar o processo
Node do `pnpm run dev` (Ctrl+C, `TaskStop`, etc.) **não mata o `workerd`**. Ele continua segurando a
porta 8787, e a próxima `wrangler dev` sobe sozinha na 8788, 8799, etc. — quebrando o proxy do Vite,
que está hardcoded para 8787.

Se `curl localhost:8787/api/health` falhar mesmo com um `wrangler dev` "rodando" segundo o
histórico da sessão, ou se o wrangler anunciar uma porta diferente de 8787, mate TODAS as camadas
(wrapper pnpm → wrangler.js → cli.js → workerd) antes de tentar de novo:

```powershell
Get-CimInstance Win32_Process -Filter "Name='node.exe' OR Name='workerd.exe'" |
  Select-Object ProcessId, CommandLine
# depois de identificar os PIDs relevantes (linha de comando contém "wrangler" ou "workerd"):
Stop-Process -Id <PID> -Force -Confirm:$false
```

Só então suba `wrangler dev` de novo e confira que a porta anunciada é 8787.

## Parar

Prefira matar por porta em vez de `pkill -f` genérico (padrão amplo demais arrisca matar o processo
da própria sessão do agente):

```powershell
Get-NetTCPConnection -LocalPort 8787 -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique |
  ForEach-Object { Stop-Process -Id $_ -Force -Confirm:$false }
```

Repita para a porta 5173 se precisar derrubar o frontend também.

## Depois de usar

Backend em modo dev usa `.dev.vars` (secrets locais) e o D1 **local** (`--local`, arquivo SQLite em
`.wrangler/state/v3/d1/`), nunca produção — seguro rodar/reiniciar à vontade. Se a feature testada
envolve tabela nova ou alterada, use a skill `d1-migration` primeiro para garantir que o schema
local está em dia.

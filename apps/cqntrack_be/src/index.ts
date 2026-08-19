import { app } from "./app";
import { createDb } from "./db/client";
import { refreshTrackedSeriesEpisodes } from "./series/refresh-episodes.job";

export default {
  fetch: app.fetch,
  // Cron Trigger (ver wrangler.toml, [triggers]) — atualiza o cache de
  // próximo episódio/último lançado das séries acompanhadas sem depender
  // de alguém abrir a tela de detalhe pra revalidar (ver
  // series/refresh-episodes.job.ts). waitUntil: a resposta do cron não
  // espera nada, mas o Worker não pode ser encerrado antes do job
  // terminar de rodar em segundo plano.
  scheduled: async (_controller: ScheduledController, env: Env, ctx: ExecutionContext) => {
    ctx.waitUntil(refreshTrackedSeriesEpisodes(env, createDb(env)));
  },
} satisfies ExportedHandler<Env>;

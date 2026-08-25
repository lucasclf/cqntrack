import { Hono } from "hono";

export const mangaCoversRouter = new Hono<{ Bindings: Env }>();

// Proxy de capas do MangaDex — obrigatório pela documentação oficial deles
// (api.mangadex.org/docs/2-limitations/): "We will serve the wrong response
// for any image hotlinked from our domains; you MUST proxy the requests".
// Ou seja, um <img src="https://uploads.mangadex.org/...\"> direto do
// navegador do usuário final recebe de propósito uma imagem errada (mesmas
// dimensões, então passa despercebido em qualquer checagem técnica de
// "carregou com sucesso" — só falha visualmente, o que intermitentemente foi
// confundido com "capa não aparece" antes desta correção). Por isso o FE
// nunca aponta pra uploads.mangadex.org diretamente — sempre por aqui (ver
// coverUrlFromManga em manga.service.ts).
//
// Sem sessão de propósito — é só um proxy de bytes de imagem pública, sem
// dado de usuário nenhum. Evita qualquer questão de cookie cross-subdomain
// e, mais importante, não quebra o app Android nativo (autentica por header
// Bearer, não cookie — ver skill android-kotlin-dev) quando ele carregar
// capas de mangá via Coil/URL direta.
mangaCoversRouter.get("/:mangaId/:fileName", async (c) => {
  const mangaId = c.req.param("mangaId");
  const fileName = c.req.param("fileName");
  if (!mangaId || !fileName) {
    return c.body(null, 400);
  }

  const upstream = await fetch(`https://uploads.mangadex.org/covers/${mangaId}/${fileName}`, {
    // A MangaDex exige um User-Agent de verdade (não falsificado) nas
    // requisições de imagem — mesma seção da doc citada acima.
    headers: { "User-Agent": "cqntrack/1.0 (+https://tracker.cqn.xyz.br)" },
  });

  if (!upstream.ok || !upstream.body) {
    return c.body(null, upstream.status === 404 ? 404 : 502);
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "image/jpeg",
      // Capa praticamente não muda depois de publicada — cache longo reduz
      // carga tanto no nosso Worker quanto na própria MangaDex.
      "Cache-Control": "public, max-age=604800, immutable",
    },
  });
});

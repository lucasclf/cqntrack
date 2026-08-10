import { z } from "zod";

// Fonte única de verdade dos tipos de mídia que o cqntrack pretende suportar
// (jogos, séries, filmes, livros) — usado tanto pela navegação/seletor de
// seção no frontend quanto pela coluna `media_type` da tabela `activity` no
// backend. Só "games" tem seção implementada; as demais existem aqui como
// preparação, não como funcionalidade pronta.
export const MEDIA_TYPES = ["games", "series", "movies", "books"] as const;

export const MediaTypeSchema = z.enum(MEDIA_TYPES);

export type MediaType = z.infer<typeof MediaTypeSchema>;

export const MEDIA_TYPE_LABELS: Record<MediaType, string> = {
  games: "Jogos",
  series: "Séries",
  movies: "Filmes",
  books: "Livros",
};

// Prefixo de rota em PT-BR de cada seção (ex.: /jogos/buscar).
export const MEDIA_TYPE_PATH: Record<MediaType, string> = {
  games: "jogos",
  series: "series",
  movies: "filmes",
  books: "livros",
};

// Seções com rotas/integração de fato implementadas — as demais aparecem na
// UI como "em breve", sem navegação real ainda.
export const IMPLEMENTED_MEDIA_TYPES: readonly MediaType[] = ["games"];

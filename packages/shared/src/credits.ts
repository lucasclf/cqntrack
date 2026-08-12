import { z } from "zod";

// Elenco de um filme/série — top 10 por ordem de relevância da própria
// TMDB, não a lista completa (evita payload gigante pra séries longas).
export const CastMemberSchema = z.object({
  personId: z.number().int(),
  name: z.string(),
  character: z.string(),
  profileUrl: z.url().nullable(),
});

export type CastMember = z.infer<typeof CastMemberSchema>;

// Mesmo formato usado tanto pra "Direção" de filme quanto "Criado por" de
// série — os dois são só "uma pessoa + foto", sem dado extra.
export const CrewMemberSchema = z.object({
  personId: z.number().int(),
  name: z.string(),
  profileUrl: z.url().nullable(),
});

export type CrewMember = z.infer<typeof CrewMemberSchema>;

// Só "Direção" de série carrega a contagem de episódios (ex.: "11
// episódios") — filme não precisa, é sempre o filme inteiro.
export const SeriesDirectorSchema = CrewMemberSchema.extend({
  episodeCount: z.number().int(),
});

export type SeriesDirector = z.infer<typeof SeriesDirectorSchema>;

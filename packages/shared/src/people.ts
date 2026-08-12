import { z } from "zod";

export const PersonSummarySchema = z.object({
  personId: z.number().int(),
  name: z.string(),
  profileUrl: z.url().nullable(),
});

export type PersonSummary = z.infer<typeof PersonSummarySchema>;

export const PersonDetailSchema = PersonSummarySchema.extend({
  biography: z.string().nullable(),
});

export type PersonDetail = z.infer<typeof PersonDetailSchema>;

// Um item da filmografia da pessoa — filme ou série, com o "papel" já
// formatado em texto pelo backend (personagem, se ator; "Diretor"/"Criador"/
// "Criador e diretor", se direção) pra não espalhar essa lógica de
// composição no frontend.
export const PersonCreditItemSchema = z.object({
  mediaType: z.enum(["movies", "series"]),
  id: z.number().int(),
  title: z.string(),
  posterUrl: z.url().nullable(),
  releaseDate: z.iso.date().nullable(),
  roleLabel: z.string(),
});

export type PersonCreditItem = z.infer<typeof PersonCreditItemSchema>;

// actingCredits/directingCredits já vêm ordenados (mais recente primeiro) —
// decidido no service, não no front. Sem paginação: filmografia inteira
// numa resposta só (ver riscos do plano — ator muito prolífico pode ter uma
// lista grande, aceitável pro tráfego do projeto).
export const PersonCreditsResponseSchema = z.object({
  person: PersonDetailSchema,
  actingCredits: z.array(PersonCreditItemSchema),
  directingCredits: z.array(PersonCreditItemSchema),
});

export type PersonCreditsResponse = z.infer<typeof PersonCreditsResponseSchema>;

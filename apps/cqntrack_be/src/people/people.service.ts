import type { PersonCreditItem, PersonCreditsResponse } from "@cqntrack/shared";
import {
  getPersonById,
  getPersonMovieCredits,
  getPersonTvCredits,
} from "../integrations/tmdb/credits";
import {
  buildPosterUrl,
  type TmdbPersonMovieCredit,
  type TmdbPersonTvCredit,
} from "../integrations/tmdb/types";

export class PersonNotFoundError extends Error {
  constructor(public readonly personId: number) {
    super(`Pessoa ${personId} não encontrada na TMDB`);
    this.name = "PersonNotFoundError";
  }
}

function toDateOrNull(value?: string): string | null {
  return value && value.length > 0 ? value : null;
}

function mapMovieCreditToItem(credit: TmdbPersonMovieCredit, roleLabel: string): PersonCreditItem {
  return {
    mediaType: "movies",
    id: credit.id,
    title: credit.title,
    posterUrl: credit.poster_path ? buildPosterUrl(credit.poster_path, "w185") : null,
    releaseDate: toDateOrNull(credit.release_date),
    roleLabel,
  };
}

function mapTvCreditToItem(credit: TmdbPersonTvCredit, roleLabel: string): PersonCreditItem {
  return {
    mediaType: "series",
    id: credit.id,
    title: credit.name,
    posterUrl: credit.poster_path ? buildPosterUrl(credit.poster_path, "w185") : null,
    releaseDate: toDateOrNull(credit.first_air_date),
    roleLabel,
  };
}

function sortByDateDesc(items: PersonCreditItem[]): PersonCreditItem[] {
  return [...items].sort((a, b) => (b.releaseDate ?? "").localeCompare(a.releaseDate ?? ""));
}

// A TMDB às vezes credita a mesma pessoa duas vezes como diretora do mesmo
// filme (créditos duplicados) — dedupe por id antes de mapear.
function dedupeById<T extends { id: number }>(credits: T[]): T[] {
  const seen = new Set<number>();
  const result: T[] = [];
  for (const credit of credits) {
    if (seen.has(credit.id)) continue;
    seen.add(credit.id);
    result.push(credit);
  }
  return result;
}

function formatSeriesDirectingRoleLabel(roles: ReadonlySet<string>): string {
  if (roles.has("Criador") && roles.has("Diretor")) {
    return "Criador e diretor";
  }
  return roles.has("Criador") ? "Criador" : "Diretor";
}

// Uma série pode aparecer duas vezes no crew da pessoa — criou E dirigiu
// episódios (caso real do Vince Gilligan em Breaking Bad). Mescla num item
// só com o rótulo combinado em vez de duplicar a linha na lista "Como diretor".
function mapSeriesDirectingCredits(credits: TmdbPersonTvCredit[]): PersonCreditItem[] {
  const bySeriesId = new Map<number, { credit: TmdbPersonTvCredit; roles: Set<string> }>();
  for (const credit of credits) {
    if (credit.job !== "Director" && credit.job !== "Creator") continue;
    const roleLabel = credit.job === "Director" ? "Diretor" : "Criador";
    const existing = bySeriesId.get(credit.id);
    if (existing) {
      existing.roles.add(roleLabel);
    } else {
      bySeriesId.set(credit.id, { credit, roles: new Set([roleLabel]) });
    }
  }
  return [...bySeriesId.values()].map(({ credit, roles }) =>
    mapTvCreditToItem(credit, formatSeriesDirectingRoleLabel(roles)),
  );
}

// Página de pessoa não tem cache em D1 (diferente de filme/série) — sempre
// busca ao vivo na TMDB. Mesmo espírito de "sem cache de episódio": dado de
// tráfego baixo, muda com o tempo, e persistir a filmografia inteira de
// cada ator seria uma tabela grande pra um ganho pequeno.
export async function getPersonDetail(env: Env, personId: number): Promise<PersonCreditsResponse> {
  const [person, movieCredits, tvCredits] = await Promise.all([
    getPersonById(env, personId),
    getPersonMovieCredits(env, personId),
    getPersonTvCredits(env, personId),
  ]);

  if (!person) {
    throw new PersonNotFoundError(personId);
  }

  const actingCredits = sortByDateDesc([
    ...dedupeById(movieCredits?.cast ?? []).map((credit) =>
      mapMovieCreditToItem(credit, credit.character ?? ""),
    ),
    ...dedupeById(tvCredits?.cast ?? []).map((credit) =>
      mapTvCreditToItem(credit, credit.character ?? ""),
    ),
  ]);

  const directingMovies = dedupeById(
    (movieCredits?.crew ?? []).filter((credit) => credit.job === "Director"),
  ).map((credit) => mapMovieCreditToItem(credit, "Diretor"));
  const directingSeries = mapSeriesDirectingCredits(tvCredits?.crew ?? []);

  return {
    person: {
      personId: person.id,
      name: person.name,
      profileUrl: person.profile_path ? buildPosterUrl(person.profile_path, "w185") : null,
      biography: person.biography.length > 0 ? person.biography : null,
    },
    actingCredits,
    directingCredits: sortByDateDesc([...directingMovies, ...directingSeries]),
  };
}

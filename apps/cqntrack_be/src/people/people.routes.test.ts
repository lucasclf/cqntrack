import { env } from "cloudflare:workers";
import { describe, expect, it, vi } from "vitest";
import { createAuthenticatedUser } from "../../test/auth-helpers";
import { app } from "../app";

const PERSON_DETAIL = {
  id: 525,
  name: "Alguém Multitalentoso",
  profile_path: "/pessoa.jpg",
  biography: "Uma biografia qualquer.",
};

const MOVIE_CREDITS = {
  cast: [
    {
      id: 10,
      title: "Filme como Ator",
      poster_path: "/filme-ator.jpg",
      release_date: "2015-06-01",
      character: "Personagem X",
    },
  ],
  crew: [
    {
      id: 20,
      title: "Filme Dirigido",
      poster_path: "/filme-dirigido.jpg",
      release_date: "2020-01-01",
      department: "Directing",
      job: "Director",
    },
    // Crédito duplicado do mesmo filme — não pode aparecer duas vezes.
    {
      id: 20,
      title: "Filme Dirigido",
      poster_path: "/filme-dirigido.jpg",
      release_date: "2020-01-01",
      department: "Directing",
      job: "Director",
    },
  ],
};

const TV_CREDITS = {
  cast: [
    {
      id: 30,
      name: "Série como Ator",
      poster_path: "/serie-ator.jpg",
      first_air_date: "2010-03-01",
      character: "Personagem Y",
    },
  ],
  crew: [
    {
      id: 40,
      name: "Série Criada e Dirigida",
      poster_path: "/serie-criada.jpg",
      first_air_date: "2012-09-01",
      department: "Directing",
      job: "Director",
    },
    {
      id: 40,
      name: "Série Criada e Dirigida",
      poster_path: "/serie-criada.jpg",
      first_air_date: "2012-09-01",
      department: "Creator",
      job: "Creator",
    },
    {
      id: 50,
      name: "Série Só Escrita",
      poster_path: null,
      first_air_date: "2018-05-01",
      department: "Writing",
      job: "Writer",
    },
  ],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function stubPersonFetch(person: unknown, movieCredits: unknown, tvCredits: unknown): void {
  // getPersonDetail dispara os 3 requests em paralelo (Promise.all) — a
  // ordem de chamada ainda é determinística (segue a ordem do array), mas
  // não dá pra assumir isso caso a implementação mude; os 3 corpos aqui
  // são intercambiáveis por posição de chamada.
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(jsonResponse(person))
    .mockResolvedValueOnce(jsonResponse(movieCredits))
    .mockResolvedValueOnce(jsonResponse(tvCredits));
  vi.stubGlobal("fetch", fetchMock);
}

describe("GET /api/people/:personId", () => {
  it("sem sessão retorna 401", async () => {
    const res = await app.request("/api/people/525", undefined, env);

    expect(res.status).toBe(401);
  });

  it("id inválido retorna 400", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);

    const res = await app.request("/api/people/nao-e-um-id", { headers: { cookie } }, env);

    expect(res.status).toBe(400);
  });

  it("pessoa inexistente na TMDB retorna 404", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => jsonResponse({ status_message: "not found" }, 404)),
    );

    const res = await app.request("/api/people/999999999", { headers: { cookie } }, env);

    expect(res.status).toBe(404);
    vi.unstubAllGlobals();
  });

  it("monta atuação e direção separadas, mesclando criador+diretor da mesma série e sem duplicar crédito", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubPersonFetch(PERSON_DETAIL, MOVIE_CREDITS, TV_CREDITS);

    const res = await app.request("/api/people/525", { headers: { cookie } }, env);

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      person: {
        personId: number;
        name: string;
        profileUrl: string | null;
        biography: string | null;
      };
      actingCredits: { mediaType: string; id: number; title: string; roleLabel: string }[];
      directingCredits: { mediaType: string; id: number; title: string; roleLabel: string }[];
    };

    expect(body.person).toEqual({
      personId: 525,
      name: "Alguém Multitalentoso",
      profileUrl: "https://image.tmdb.org/t/p/w185/pessoa.jpg",
      biography: "Uma biografia qualquer.",
    });

    // Atuação: filme + série, ordenados por data decrescente (2015 > 2010,
    // então o filme vem primeiro).
    expect(body.actingCredits).toEqual([
      {
        mediaType: "movies",
        id: 10,
        title: "Filme como Ator",
        posterUrl: "https://image.tmdb.org/t/p/w185/filme-ator.jpg",
        releaseDate: "2015-06-01",
        roleLabel: "Personagem X",
      },
      {
        mediaType: "series",
        id: 30,
        title: "Série como Ator",
        posterUrl: "https://image.tmdb.org/t/p/w185/serie-ator.jpg",
        releaseDate: "2010-03-01",
        roleLabel: "Personagem Y",
      },
    ]);

    // Direção: filme dirigido (sem duplicar o crédito repetido) + série
    // mesclada como "Criador e diretor" — a série "Só Escrita" (job Writer)
    // fica de fora. Ordenado por data decrescente (filme, 2020, vem antes
    // da série, 2012).
    expect(body.directingCredits).toEqual([
      {
        mediaType: "movies",
        id: 20,
        title: "Filme Dirigido",
        posterUrl: "https://image.tmdb.org/t/p/w185/filme-dirigido.jpg",
        releaseDate: "2020-01-01",
        roleLabel: "Diretor",
      },
      {
        mediaType: "series",
        id: 40,
        title: "Série Criada e Dirigida",
        posterUrl: "https://image.tmdb.org/t/p/w185/serie-criada.jpg",
        releaseDate: "2012-09-01",
        roleLabel: "Criador e diretor",
      },
    ]);

    vi.unstubAllGlobals();
  });

  it("biografia vazia vira null", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubPersonFetch(
      { ...PERSON_DETAIL, id: 526, biography: "" },
      { cast: [], crew: [] },
      { cast: [], crew: [] },
    );

    const res = await app.request("/api/people/526", { headers: { cookie } }, env);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { person: { biography: string | null } };
    expect(body.person.biography).toBeNull();
    vi.unstubAllGlobals();
  });

  it("sem foto (profile_path null) devolve profileUrl null", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubPersonFetch(
      { ...PERSON_DETAIL, id: 527, profile_path: null },
      { cast: [], crew: [] },
      { cast: [], crew: [] },
    );

    const res = await app.request("/api/people/527", { headers: { cookie } }, env);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { person: { profileUrl: string | null } };
    expect(body.person.profileUrl).toBeNull();
    vi.unstubAllGlobals();
  });
});

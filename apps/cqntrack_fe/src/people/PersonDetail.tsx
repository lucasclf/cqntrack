import { MEDIA_TYPE_PATH, type PersonCreditItem, type PersonCreditsResponse } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { ApiError, apiClient } from "../lib/api-client";
import styles from "./PersonDetail.module.css";

type LoadStatus = "loading" | "ready" | "not-found" | "error";

function PersonCreditCard({ credit }: { credit: PersonCreditItem }) {
  const year = credit.releaseDate ? credit.releaseDate.slice(0, 4) : null;

  return (
    <Link to={`/${MEDIA_TYPE_PATH[credit.mediaType]}/${credit.id}`} className={styles.card}>
      <div className={styles.coverWrap}>
        {credit.posterUrl ? (
          <img className={styles.cover} src={credit.posterUrl} alt="" loading="lazy" />
        ) : (
          <div className={styles.coverPlaceholder} aria-hidden="true" />
        )}
      </div>
      <div className={styles.info}>
        <p className={styles.title}>{credit.title}</p>
        <p className={styles.roleLabel}>
          {credit.roleLabel}
          {year && ` · ${year}`}
        </p>
      </div>
    </Link>
  );
}

function CreditsSection({ title, credits }: { title: string; credits: PersonCreditItem[] }) {
  if (credits.length === 0) {
    return null;
  }

  return (
    <section className={styles.section}>
      <h2>{title}</h2>
      <div className={styles.grid}>
        {credits.map((credit) => (
          <PersonCreditCard key={`${credit.mediaType}-${credit.id}`} credit={credit} />
        ))}
      </div>
    </section>
  );
}

// Sem entrypoint próprio (busca/rota de nível raiz) — só alcançável por
// link de dentro de um filme/série (CastList/CrewList). Sem cache: busca
// ao vivo na TMDB a cada acesso (ver people.service.ts no backend).
export function PersonDetail() {
  const { personId } = useParams<{ personId: string }>();
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [detail, setDetail] = useState<PersonCreditsResponse | null>(null);

  const [trackedPersonId, setTrackedPersonId] = useState(personId);
  if (personId !== trackedPersonId) {
    setTrackedPersonId(personId);
    setLoadStatus("loading");
  }

  useEffect(() => {
    let cancelled = false;

    apiClient
      .get<PersonCreditsResponse>(`/api/people/${personId}`)
      .then((data) => {
        if (cancelled) return;
        setDetail(data);
        setLoadStatus("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadStatus(error instanceof ApiError && error.status === 404 ? "not-found" : "error");
      });

    return () => {
      cancelled = true;
    };
  }, [personId]);

  if (loadStatus === "loading") {
    return <p>Carregando...</p>;
  }
  if (loadStatus === "not-found") {
    return <p>Pessoa não encontrada.</p>;
  }
  if (loadStatus === "error" || !detail) {
    return <p role="alert">Falha ao carregar a pessoa. Tente novamente.</p>;
  }

  const { person, actingCredits, directingCredits } = detail;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        {person.profileUrl ? (
          <img className={styles.photo} src={person.profileUrl} alt="" />
        ) : (
          <div className={styles.photoPlaceholder} aria-hidden="true" />
        )}
        <div>
          <h1>{person.name}</h1>
          {person.biography && <p className={styles.biography}>{person.biography}</p>}
        </div>
      </div>

      {actingCredits.length === 0 && directingCredits.length === 0 && (
        <p className={styles.hint}>Nenhum crédito de ator ou diretor encontrado.</p>
      )}

      <CreditsSection title="Como ator" credits={actingCredits} />
      <CreditsSection title="Como diretor" credits={directingCredits} />
    </div>
  );
}

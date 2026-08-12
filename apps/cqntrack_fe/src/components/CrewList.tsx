import type { CrewMember } from "@cqntrack/shared";
import { Link } from "react-router";
import styles from "./CrewList.module.css";

interface CrewListProps {
  title: string;
  // SeriesDirector (CrewMember + episodeCount) também cabe aqui — o campo é
  // opcional porque só "Direção" de série carrega essa contagem ("Criado
  // por" de série e "Direção" de filme não têm).
  crew: (CrewMember & { episodeCount?: number })[];
}

// Reutilizado pra "Direção" de filme, "Criado por" de série e "Direção" de
// série — mesmo formato de pessoa+foto nos três casos, cada um linkando pra
// página da pessoa (/pessoas/:personId). Não renderiza nada quando a lista
// está vazia.
export function CrewList({ title, crew }: CrewListProps) {
  if (crew.length === 0) {
    return null;
  }

  return (
    <section className={styles.section}>
      <h2>{title}</h2>
      <ul className={styles.list}>
        {crew.map((member) => (
          <li key={member.personId}>
            <Link to={`/pessoas/${member.personId}`} className={styles.item}>
              {member.profileUrl ? (
                <img className={styles.photo} src={member.profileUrl} alt="" loading="lazy" />
              ) : (
                <div className={styles.photoPlaceholder} aria-hidden="true" />
              )}
              <span className={styles.name}>
                {member.name}
                {member.episodeCount !== undefined && (
                  <span className={styles.episodeCount}> ({member.episodeCount} episódios)</span>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

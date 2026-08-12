import type { CastMember } from "@cqntrack/shared";
import { Link } from "react-router";
import styles from "./CastList.module.css";

interface CastListProps {
  title: string;
  cast: CastMember[];
}

// Elenco de filme/série — grade horizontal com rolagem, cada cartão
// linkando pra página da pessoa (/pessoas/:personId). Reutilizado por
// MovieDetail e SeriesDetail (mesmo formato nos dois). Não renderiza nada
// quando a lista está vazia, mesmo padrão de MovieFavoritesSection.
export function CastList({ title, cast }: CastListProps) {
  if (cast.length === 0) {
    return null;
  }

  return (
    <section className={styles.section}>
      <h2>{title}</h2>
      <div className={styles.grid}>
        {cast.map((member) => (
          <Link key={member.personId} to={`/pessoas/${member.personId}`} className={styles.card}>
            {member.profileUrl ? (
              <img className={styles.photo} src={member.profileUrl} alt="" loading="lazy" />
            ) : (
              <div className={styles.photoPlaceholder} aria-hidden="true" />
            )}
            <p className={styles.name}>{member.name}</p>
            {member.character && <p className={styles.character}>{member.character}</p>}
          </Link>
        ))}
      </div>
    </section>
  );
}

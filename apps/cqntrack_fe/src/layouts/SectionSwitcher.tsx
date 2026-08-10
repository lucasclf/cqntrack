import { IMPLEMENTED_MEDIA_TYPES, MEDIA_TYPE_LABELS, MEDIA_TYPE_PATH, MEDIA_TYPES } from "@cqntrack/shared";
import { Link, useLocation } from "react-router";
import styles from "./SectionSwitcher.module.css";

// Fileira de seções (Jogos/Séries/Filmes/Livros) — só Jogos está implementado
// por enquanto; as demais aparecem desabilitadas, com o espaço já reservado
// pra quando existirem de verdade (CLAUDE.md: próximas seções replicam o
// padrão de jogos).
export function SectionSwitcher() {
  const { pathname } = useLocation();

  return (
    <nav className={styles.switcher} aria-label="Seções">
      {MEDIA_TYPES.map((mediaType) => {
        const label = MEDIA_TYPE_LABELS[mediaType];

        if (!IMPLEMENTED_MEDIA_TYPES.includes(mediaType)) {
          return (
            <span key={mediaType} className={styles.disabledTab}>
              {label}
              <span className={styles.comingSoon}>em breve</span>
            </span>
          );
        }

        const prefix = `/${MEDIA_TYPE_PATH[mediaType]}`;
        const isActive = pathname === prefix || pathname.startsWith(`${prefix}/`);

        return (
          <Link
            key={mediaType}
            to={`${prefix}/buscar`}
            aria-current={isActive ? "page" : undefined}
            className={isActive ? `${styles.tab} ${styles.tabActive}` : styles.tab}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

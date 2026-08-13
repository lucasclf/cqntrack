import { NavLink } from "react-router";
import styles from "./ProfileTabs.module.css";

export type ProfileTab = "movies" | "series" | "games" | "books";

const TABS: { key: ProfileTab; label: string; path: string }[] = [
  { key: "movies", label: "Filmes", path: "filmes" },
  { key: "series", label: "Séries", path: "series" },
  { key: "games", label: "Jogos", path: "jogos" },
  { key: "books", label: "Livros", path: "livros" },
];

interface ProfileTabsProps {
  // "/@username" — cada aba linka pra "${sectionPrefix}/<path>", sempre sem
  // query string (navegar pra uma aba limpa qualquer filtro de status
  // ativo). Navegação de verdade (não troca de estado local) — é o que
  // mantém a URL atualizável/compartilhável e permite manter o header/
  // lateral montados via layout persistente (ver PublicProfile).
  sectionPrefix: string;
}

export function ProfileTabs({ sectionPrefix }: ProfileTabsProps) {
  return (
    <nav className={styles.tabs} aria-label="Mídia">
      {TABS.map((tab) => (
        <NavLink
          key={tab.key}
          to={`${sectionPrefix}/${tab.path}`}
          className={({ isActive }) =>
            isActive ? `${styles.tab} ${styles.tabActive}` : styles.tab
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}

import styles from "./HomeTabs.module.css";

export type HomeTab = "movies" | "series" | "games" | "books" | "activity";

const TABS: { key: HomeTab; label: string }[] = [
  { key: "movies", label: "Filmes" },
  { key: "series", label: "Séries" },
  { key: "games", label: "Jogos" },
  { key: "books", label: "Livros" },
  { key: "activity", label: "Atividades" },
];

interface HomeTabsProps {
  active: HomeTab;
  onChange: (tab: HomeTab) => void;
}

// Mesmo espírito visual de ProfileTabs (perfil público), mas com estado
// local em vez de rota — a home vive dentro do AppShell, e os caminhos
// "/filmes", "/series" etc. já são as telas de Descobrir/marcações de cada
// seção, então as abas daqui não podem reivindicar esses paths.
export function HomeTabs({ active, onChange }: HomeTabsProps) {
  return (
    <nav className={styles.tabs} aria-label="Mídia">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          aria-current={active === tab.key ? "page" : undefined}
          className={active === tab.key ? `${styles.tab} ${styles.tabActive}` : styles.tab}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

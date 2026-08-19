import styles from "./HomeTabs.module.css";

export type HomeTab = "continueWatching" | "movies" | "games" | "books" | "activity";

const TABS: { key: HomeTab; label: string }[] = [
  { key: "continueWatching", label: "Continuar assistindo" },
  { key: "movies", label: "Filmes" },
  { key: "games", label: "Jogos" },
  { key: "books", label: "Livros" },
  { key: "activity", label: "Atividades recentes" },
];

interface HomeTabsProps {
  active: HomeTab;
  onChange: (tab: HomeTab) => void;
}

// Abas puramente visuais (estado local, não rota) — todo o conteúdo das 5
// já carrega assim que a Home monta (ver Home.tsx, cada seção fica no DOM
// o tempo todo, só escondida via `hidden`), trocar de aba não refaz
// nenhum fetch. Os caminhos "/filmes", "/jogos" etc. já são as telas de
// Descobrir/marcações de cada seção (ver router.tsx), então as abas daqui
// não podem reivindicar esses paths.
export function HomeTabs({ active, onChange }: HomeTabsProps) {
  return (
    <nav className={styles.tabs} aria-label="Seções da home">
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

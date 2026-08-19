import styles from "./HomeTabs.module.css";

export type HomeTab = "movies" | "games" | "books";

const TABS: { key: HomeTab; label: string }[] = [
  { key: "movies", label: "Filmes" },
  { key: "games", label: "Jogos" },
  { key: "books", label: "Livros" },
];

interface HomeTabsProps {
  active: HomeTab;
  onChange: (tab: HomeTab) => void;
}

// Só a seção secundária da Home usa isso agora (favoritos/recentes/
// estatísticas de Filmes/Jogos/Livros) — Séries ganhou sua própria seção
// primária ("Continuar assistindo", ver ContinueWatching.tsx) e Atividades
// virou seção própria (ActivityTab), não mais uma aba aqui.
//
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

import styles from "./MediaSubTabs.module.css";

export type MediaSubTab = "favorites" | "recent";

interface MediaSubTabsProps {
  active: MediaSubTab;
  onChange: (tab: MediaSubTab) => void;
  // "Assistido recentemente" (filmes/séries) | "Jogado recentemente"
  // (jogos) | "Lido recentemente" (livros) — só esse rótulo varia por
  // mídia, o resto do componente é idêntico.
  recentLabel: string;
}

// Sub-abas "Favoritos"/"Assistido recentemente" dentro de cada seção de
// mídia da Home (ver MovieCategoryPanel e afins) — trocam o antigo par
// empilhado (favoritos + recentes num carrossel horizontal só) por 2
// listas independentes, cada uma com sua própria rolagem infinita vertical
// (ver InfiniteMediaGrid).
export function MediaSubTabs({ active, onChange, recentLabel }: MediaSubTabsProps) {
  return (
    <div className={styles.tabs} role="tablist">
      <button
        type="button"
        role="tab"
        aria-selected={active === "favorites"}
        className={active === "favorites" ? `${styles.tab} ${styles.tabActive}` : styles.tab}
        onClick={() => onChange("favorites")}
      >
        Favoritos
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={active === "recent"}
        className={active === "recent" ? `${styles.tab} ${styles.tabActive}` : styles.tab}
        onClick={() => onChange("recent")}
      >
        {recentLabel}
      </button>
    </div>
  );
}

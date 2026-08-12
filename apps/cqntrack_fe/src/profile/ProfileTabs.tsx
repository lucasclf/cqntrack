import styles from "./ProfileTabs.module.css";

export type ProfileTab = "movies" | "series" | "games" | "books";

const TABS: { key: ProfileTab; label: string }[] = [
  { key: "movies", label: "Filmes" },
  { key: "series", label: "Séries" },
  { key: "games", label: "Jogos" },
  { key: "books", label: "Livros" },
];

interface ProfileTabsProps {
  active: ProfileTab;
  onChange: (tab: ProfileTab) => void;
}

export function ProfileTabs({ active, onChange }: ProfileTabsProps) {
  return (
    <div className={styles.tabs} role="tablist">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={active === tab.key}
          className={active === tab.key ? `${styles.tab} ${styles.tabActive}` : styles.tab}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

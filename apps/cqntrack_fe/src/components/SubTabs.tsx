import styles from "./SubTabs.module.css";

export interface SubTabOption<TKey extends string> {
  key: TKey;
  label: string;
}

interface SubTabsProps<TKey extends string> {
  tabs: SubTabOption<TKey>[];
  active: TKey;
  onChange: (tab: TKey) => void;
}

// Faixa de sub-abas genérica (N opções) — generalizado a partir do antigo
// MediaSubTabs (fixo em 2: Favoritos/Recente), pra também servir a 3ª aba
// "Descobrir" de cada seção de mídia e as 3 abas da Social
// (Listar/Atividades/Procurar). Puramente apresentacional, mesmo CSS de
// antes (SubTabs.module.css) — um `display:flex` de botões já suporta
// qualquer quantidade de itens sem ajuste.
export function SubTabs<TKey extends string>({ tabs, active, onChange }: SubTabsProps<TKey>) {
  return (
    <div className={styles.tabs} role="tablist">
      {tabs.map((tab) => (
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

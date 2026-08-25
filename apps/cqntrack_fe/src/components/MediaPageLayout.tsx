import type { ReactNode } from "react";
import styles from "./MediaPageLayout.module.css";

interface MediaPageLayoutProps {
  main: ReactNode;
  sidebar: ReactNode;
}

// Layout de página de seção de mídia (painel + estatísticas na lateral) —
// extraído do bloco que antes vivia repetido 5x dentro de Home.tsx, agora
// reaproveitado pelos 5 `<Seção>CategoryPage.tsx` (cada seção virou rota
// própria, ver router.tsx).
export function MediaPageLayout({ main, sidebar }: MediaPageLayoutProps) {
  return (
    <div className={styles.layout}>
      <div className={styles.main}>{main}</div>
      <aside className={styles.sidebar}>{sidebar}</aside>
    </div>
  );
}

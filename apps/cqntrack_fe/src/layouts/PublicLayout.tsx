import type { ReactNode } from "react";
import { Link } from "react-router";
import { CatMark } from "../CatMark";
import { ThemeToggle } from "../ThemeToggle";
import styles from "./PublicLayout.module.css";

interface PublicLayoutProps {
  children: ReactNode;
}

// Casca mínima pra visitante anônimo (ou dono, por ora — ver nota de escopo
// no PublicProfile) em /u/:username: só logo + toggle de tema, sem nav.
export function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <div className={styles.page}>
      <ThemeToggle />
      <header className={styles.header}>
        <Link to="/login" className={styles.brand}>
          <span className={styles.brandMark}>
            <CatMark className={styles.brandMarkIcon} />
          </span>
          <span className={styles.brandWord}>cqntrack</span>
        </Link>
      </header>
      <main className={styles.content}>{children}</main>
    </div>
  );
}

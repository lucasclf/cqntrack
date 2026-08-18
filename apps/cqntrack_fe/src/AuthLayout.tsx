import type { ReactNode } from "react";
import styles from "./AuthLayout.module.css";
import { CatMark } from "./CatMark";
import { ThemeToggle } from "./ThemeToggle";

const COLLAGE_TILE_COUNT = 18;

interface AuthLayoutProps {
  children: ReactNode;
}

// Casca visual compartilhada entre as páginas de autenticação (login, cadastro, erro etc.).
export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className={styles.page}>
      <ThemeToggle className={styles.themeToggle} />

      <aside className={styles.visualPanel}>
        <div className={styles.collage} aria-hidden="true">
          {Array.from({ length: COLLAGE_TILE_COUNT }).map((_, index) => (
            <div key={index} />
          ))}
        </div>
        <div className={styles.scrim} />
        <div className={styles.visualContent}>
          <div className={styles.brand}>
            <span className={styles.brandMark}>
              <CatMark className={styles.brandMarkIcon} />
            </span>
            <span className={styles.brandWord}>cqntrack</span>
          </div>
        </div>
      </aside>

      <main className={styles.formPanel}>
        <div className={styles.formWrap}>
          <div className={`${styles.brand} ${styles.brandCompact}`}>
            <span className={styles.brandMark}>
              <CatMark className={styles.brandMarkIcon} />
            </span>
            <span className={styles.brandWord}>cqntrack</span>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

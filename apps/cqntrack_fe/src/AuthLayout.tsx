import type { ReactNode } from "react";
import styles from "./AuthLayout.module.css";
import { ThemeToggle } from "./ThemeToggle";

const COLLAGE_TILE_COUNT = 18;

interface AuthLayoutProps {
  children: ReactNode;
}

// Casca visual compartilhada entre as páginas de autenticação (login, cadastro, erro etc.).
export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className={styles.page}>
      <ThemeToggle />

      <aside className={styles.visualPanel}>
        <div className={styles.collage} aria-hidden="true">
          {Array.from({ length: COLLAGE_TILE_COUNT }).map((_, index) => (
            <div key={index} />
          ))}
        </div>
        <div className={styles.scrim} />
        <div className={styles.visualContent}>
          <div className={styles.brand}>
            <span className={styles.brandMark}>c</span>
            <span className={styles.brandWord}>cqntrack</span>
          </div>
          <div className={styles.visualBottom}>
            <p className={styles.tagline}>
              Tudo que você jogou, assistiu e leu, em um só lugar.
            </p>
            <div className={styles.tags}>
              <span className={styles.tag}>Jogos</span>
              <span className={styles.tag}>Séries</span>
              <span className={styles.tag}>Filmes</span>
              <span className={styles.tag}>Livros</span>
            </div>
          </div>
        </div>
      </aside>

      <main className={styles.formPanel}>
        <div className={styles.formWrap}>
          <div className={`${styles.brand} ${styles.brandCompact}`}>
            <span className={styles.brandMark}>c</span>
            <span className={styles.brandWord}>cqntrack</span>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

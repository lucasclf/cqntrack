import type { ReactNode } from "react";
import { Link } from "react-router";
import { CatMark } from "../CatMark";
import { authClient } from "../lib/auth-client";
import { ThemeToggle } from "../ThemeToggle";
import styles from "./PublicLayout.module.css";
import { TopBar } from "./TopBar";

interface PublicLayoutProps {
  children: ReactNode;
}

// Casca de telas públicas (ex.: /@:username) — anônimo (ou sessão ainda
// carregando) vê a casca mínima, só logo + toggle de tema, sem nav. Quem
// está logado vê a mesma barra superior da área autenticada (TopBar), pra
// não perder acesso à navegação principal só por estar vendo o perfil de
// outra pessoa.
export function PublicLayout({ children }: PublicLayoutProps) {
  const { data: session } = authClient.useSession();

  if (session) {
    return (
      <div className={styles.page}>
        <TopBar />
        <main className={styles.content}>{children}</main>
      </div>
    );
  }

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

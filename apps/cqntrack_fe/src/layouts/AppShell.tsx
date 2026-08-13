import { Outlet } from "react-router";
import styles from "./AppShell.module.css";
import { TopBar } from "./TopBar";

// Casca da área autenticada: barra superior (ver TopBar, também
// reaproveitada por PublicLayout quando o visitante logado está numa tela
// pública) + conteúdo da rota ativa.
export function AppShell() {
  return (
    <div className={styles.shell}>
      <TopBar />
      <main className={styles.content}>
        <Outlet />
      </main>
    </div>
  );
}

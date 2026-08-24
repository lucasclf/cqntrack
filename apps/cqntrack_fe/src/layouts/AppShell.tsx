import { Outlet } from "react-router";
import styles from "./AppShell.module.css";
import { ConfirmDialogProvider } from "../lib/ConfirmDialogProvider";
import { TopBar } from "./TopBar";

// Casca da área autenticada: barra superior (ver TopBar, também
// reaproveitada por PublicLayout quando o visitante logado está numa tela
// pública) + conteúdo da rota ativa. ConfirmDialogProvider fica aqui (não em
// App.tsx) porque todo call site de confirmação hoje vive dentro de rotas
// autenticadas — ver ConfirmDialogProvider.tsx.
export function AppShell() {
  return (
    <ConfirmDialogProvider>
      <div className={styles.shell}>
        <TopBar />
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </ConfirmDialogProvider>
  );
}

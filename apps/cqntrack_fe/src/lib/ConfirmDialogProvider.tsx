import { type ReactNode, useCallback, useState } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ConfirmContext, type ConfirmFn, type ConfirmOptions } from "./ConfirmDialogContext";

interface PendingConfirm extends ConfirmOptions {
  resolve: (result: boolean) => void;
}

// Provider único (montado em AppShell) que troca window.confirm() por um
// modal no mesmo estilo visual do resto do site (ver ConfirmDialog/
// ListFormModal). A API imperativa (`await confirm(...)`, ver useConfirm.ts)
// preserva o mesmo formato de chamada de window.confirm — os call sites
// originais (alguns bloqueantes tipo `if (!confirm) return`, outros que
// continuam de qualquer jeito e só ramificam o resultado, ver toggleEpisode
// em SeriesEpisodeList) não precisam ser reestruturados, só ganham um
// "await" na frente.
export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    const normalized = typeof options === "string" ? { message: options } : options;
    return new Promise<boolean>((resolve) => {
      setPending({ ...normalized, resolve });
    });
  }, []);

  function handleConfirm() {
    pending?.resolve(true);
    setPending(null);
  }

  function handleCancel() {
    pending?.resolve(false);
    setPending(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <ConfirmDialog
          title={pending.title}
          message={pending.message}
          confirmLabel={pending.confirmLabel}
          cancelLabel={pending.cancelLabel}
          danger={pending.danger}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </ConfirmContext.Provider>
  );
}

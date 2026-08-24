import { useEffect, useRef } from "react";
import styles from "./ConfirmDialog.module.css";

// Mesma lista de tags de ListFormModal.tsx — reaproveitada aqui pro focus trap.
const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export interface ConfirmDialogProps {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// Modal de confirmação genérico, mesmo padrão visual/interação de
// ListFormModal.tsx (overlay + foco preso + Esc fecha, sem lib de portal) —
// usado no lugar de window.confirm() em qualquer ação destrutiva/reversível
// do app. Ver ConfirmDialogProvider pra API imperativa (useConfirm()).
export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCancel();
        return;
      }
      if (event.key !== "Tab" || !modalRef.current) {
        return;
      }
      const focusable = modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusable.length === 0) {
        return;
      }
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <div className={styles.overlay} role="presentation" onClick={onCancel}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label={title ?? "Confirmação"}
        onClick={(event) => event.stopPropagation()}
        ref={modalRef}
      >
        {title && <h2>{title}</h2>}
        <p>{message}</p>
        <div className={styles.actions}>
          {/* Foco no Cancelar por padrão — evita confirmar sem querer numa ação
              destrutiva com Enter acidental. */}
          <button type="button" className={styles.cancelButton} onClick={onCancel} autoFocus>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={danger ? `${styles.confirmButton} ${styles.danger}` : styles.confirmButton}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

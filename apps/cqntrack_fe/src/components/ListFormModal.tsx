import { type FormEvent, useEffect, useRef, useState } from "react";
import { ApiError } from "../lib/api-client";
import styles from "./ListFormModal.module.css";

// Seletor de elementos focáveis pra restringir o Tab dentro do modal —
// mesma lista de tags que qualquer implementação simples de focus trap usa.
const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export interface ListFormValues {
  name: string;
  description: string | null;
}

interface ListFormModalProps {
  mode: "create" | "edit";
  initialValues?: ListFormValues;
  onSubmit: (values: ListFormValues) => Promise<void>;
  onClose: () => void;
}

// Modal simples (sem lib de portal) reutilizado por qualquer seção que tenha
// listas (jogos, séries) — criar (MyLists/MySeriesLists) ou editar nome/
// descrição (ListDetail/SeriesListDetail).
export function ListFormModal({ mode, initialValues, onSubmit, onClose }: ListFormModalProps) {
  const [name, setName] = useState(initialValues?.name ?? "");
  const [description, setDescription] = useState(initialValues?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Esc fecha o modal; Tab/Shift+Tab ficam presos dentro dele (focus trap) —
  // sem isso, apesar do aria-modal="true", dava pra sair do modal com Tab e
  // interagir com o conteúdo por trás do overlay.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
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
  }, [onClose]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({ name: name.trim(), description: description.trim() || null });
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 409
          ? "Já existe uma lista com esse nome."
          : "Falha ao salvar a lista. Tente novamente.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.overlay} role="presentation" onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label={mode === "create" ? "Nova lista" : "Editar lista"}
        onClick={(event) => event.stopPropagation()}
        ref={modalRef}
      >
        <h2>{mode === "create" ? "Nova lista" : "Editar lista"}</h2>
        <form onSubmit={handleSubmit}>
          <label className={styles.field}>
            <span>Nome</span>
            <input
              type="text"
              value={name}
              maxLength={80}
              required
              autoFocus
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className={styles.field}>
            <span>Descrição (opcional)</span>
            <textarea
              value={description ?? ""}
              maxLength={300}
              rows={3}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          {error && <p role="alert">{error}</p>}
          <div className={styles.actions}>
            <button type="button" onClick={onClose} disabled={submitting}>
              Cancelar
            </button>
            <button type="submit" disabled={submitting}>
              {submitting ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import { createContext } from "react";

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export type ConfirmFn = (options: ConfirmOptions | string) => Promise<boolean>;

// Separado de ConfirmDialogProvider.tsx/useConfirm.ts de propósito — um
// arquivo que só exporta componentes é exigido pelo react-refresh (regra
// react-refresh/only-export-components), e este Context é usado tanto pelo
// Provider quanto pelo hook.
export const ConfirmContext = createContext<ConfirmFn | null>(null);

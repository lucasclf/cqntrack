import { useContext } from "react";
import { ConfirmContext, type ConfirmFn } from "./ConfirmDialogContext";

export function useConfirm(): ConfirmFn {
  const confirm = useContext(ConfirmContext);
  if (!confirm) {
    throw new Error("useConfirm precisa estar dentro de ConfirmDialogProvider");
  }
  return confirm;
}

import { useState } from "react";
import styles from "./PasswordField.module.css";

interface PasswordFieldProps {
  label: string;
  autoComplete: string;
  value: string;
  onChange: (value: string) => void;
}

/** Campo de senha com toggle de mostrar/ocultar — usado em toda tela de auth (login, cadastro, redefinir/trocar senha). */
export function PasswordField({ label, autoComplete, value, onChange }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <label className={styles.field}>
      <span>{label}</span>
      <div className={styles.passwordWrapper}>
        <input
          type={visible ? "text" : "password"}
          placeholder="••••••••"
          autoComplete={autoComplete}
          required
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          className={styles.togglePassword}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? "Ocultar" : "Mostrar"}
        </button>
      </div>
    </label>
  );
}

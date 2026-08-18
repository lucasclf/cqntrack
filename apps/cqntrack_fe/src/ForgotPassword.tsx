import { ForgotPasswordFormSchema } from "@cqntrack/shared";
import { type FormEvent, useState } from "react";
import { Link } from "react-router";
import layoutStyles from "./AuthLayout.module.css";
import { AuthLayout } from "./AuthLayout";
import styles from "./ForgotPassword.module.css";
import { authClient } from "./lib/auth-client";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = ForgotPasswordFormSchema.safeParse({ email });
    if (!parsed.success) {
      setError("Preencha um e-mail válido.");
      return;
    }

    setSubmitting(true);
    await authClient.requestPasswordReset({
      email: parsed.data.email,
      redirectTo: `${import.meta.env.VITE_WEB_ORIGIN || window.location.origin}/redefinir-senha`,
    });
    setSubmitting(false);

    // O backend sempre responde sucesso aqui, exista ou não o e-mail
    // (proteção anti-enumeração do better-auth) — o FE espelha isso: nunca
    // revela se a conta existe, só mostra a mesma mensagem genérica.
    setSent(true);
  }

  if (sent) {
    return (
      <AuthLayout>
        <h1>Confira seu e-mail</h1>
        <p className={layoutStyles.subtitle}>
          Se esse e-mail tiver uma conta, mandamos um link pra redefinir a senha.
        </p>
        <p className={styles.loginHint}>
          <Link to="/login" className={layoutStyles.link}>
            Voltar pra tela de entrar
          </Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h1>Esqueci minha senha</h1>
      <p className={layoutStyles.subtitle}>
        Digite seu e-mail e mandamos um link pra você escolher uma senha nova.
      </p>
      <form onSubmit={handleSubmit}>
        <label className={styles.field}>
          <span>E-mail</span>
          <input
            type="email"
            placeholder="voce@email.com"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        {error && (
          <p className={layoutStyles.error} role="alert">
            {error}
          </p>
        )}
        <button className={layoutStyles.btnPrimary} type="submit" disabled={submitting}>
          {submitting ? "Enviando..." : "Enviar link"}
        </button>
      </form>
      <p className={styles.loginHint}>
        Lembrou a senha?{" "}
        <Link to="/login" className={layoutStyles.link}>
          Entrar
        </Link>
      </p>
    </AuthLayout>
  );
}

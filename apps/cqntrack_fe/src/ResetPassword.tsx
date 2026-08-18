import { ResetPasswordFormSchema } from "@cqntrack/shared";
import { type FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import layoutStyles from "./AuthLayout.module.css";
import { AuthLayout } from "./AuthLayout";
import { authClient } from "./lib/auth-client";
import styles from "./ResetPassword.module.css";

// Link inválido/expirado: better-auth manda ?error=INVALID_TOKEN nesse
// caso (ver GET /api/auth/reset-password/:token no BE) em vez do token.
function InvalidLink() {
  return (
    <AuthLayout>
      <h1>Link inválido</h1>
      <p className={layoutStyles.subtitle}>
        Esse link de redefinição não existe mais, expirou, ou já foi usado.
      </p>
      <p className={styles.loginHint}>
        <Link to="/esqueci-senha" className={layoutStyles.link}>
          Pedir um link novo
        </Link>
      </p>
    </AuthLayout>
  );
}

export function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const hasError = searchParams.has("error");

  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = ResetPasswordFormSchema.safeParse({ newPassword });
    if (!parsed.success) {
      setError("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }

    setSubmitting(true);
    const { error: resetError } = await authClient.resetPassword({
      newPassword: parsed.data.newPassword,
      token: token!,
    });
    setSubmitting(false);

    if (resetError) {
      setError("Não foi possível redefinir a senha. Peça um link novo e tente de novo.");
      return;
    }

    void navigate("/login?reset=1");
  }

  if (!token || hasError) {
    return <InvalidLink />;
  }

  return (
    <AuthLayout>
      <h1>Escolher nova senha</h1>
      <p className={layoutStyles.subtitle}>Defina a nova senha da sua conta.</p>
      <form onSubmit={handleSubmit}>
        <label className={styles.field}>
          <span>Nova senha</span>
          <input
            type="password"
            placeholder="••••••••"
            autoComplete="new-password"
            required
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
        </label>
        {error && (
          <p className={layoutStyles.error} role="alert">
            {error}
          </p>
        )}
        <button className={layoutStyles.btnPrimary} type="submit" disabled={submitting}>
          {submitting ? "Salvando..." : "Redefinir senha"}
        </button>
      </form>
    </AuthLayout>
  );
}

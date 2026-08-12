import { LoginFormSchema } from "@cqntrack/shared";
import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router";
import layoutStyles from "./AuthLayout.module.css";
import { AuthLayout } from "./AuthLayout";
import { authClient } from "./lib/auth-client";
import styles from "./Login.module.css";

export function Login() {
  const navigate = useNavigate();
  const { refetch: refetchSession } = authClient.useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = LoginFormSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError("Preencha um e-mail válido e uma senha com pelo menos 8 caracteres.");
      return;
    }

    setSubmitting(true);
    const { error: signInError } = await authClient.signIn.email({
      email: parsed.data.email,
      password: parsed.data.password,
      rememberMe,
    });
    setSubmitting(false);

    if (signInError) {
      setError("E-mail ou senha inválidos.");
      return;
    }

    // RequireAuth lê a sessão de um estado compartilhado que só se atualiza
    // sozinho em segundo plano — sem esperar esse refetch aqui, ele ainda
    // vê "sem sessão" no instante em que navegamos, manda de volta pro
    // login, e só o próximo clique (já com a sessão atualizada) funciona.
    await refetchSession();
    void navigate("/");
  }

  return (
    <AuthLayout>
      <h1>Entrar</h1>
      <p className={layoutStyles.subtitle}>Bem-vindo de volta. Acesse sua conta para continuar.</p>
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
        <label className={styles.field}>
          <span>Senha</span>
          <input
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <div className={styles.formRow}>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
            />
            Manter conectado
          </label>
          <Link to="/esqueci-senha" className={layoutStyles.link}>
            Esqueci minha senha
          </Link>
        </div>
        {error && (
          <p className={layoutStyles.error} role="alert">
            {error}
          </p>
        )}
        <button className={layoutStyles.btnPrimary} type="submit" disabled={submitting}>
          {submitting ? "Entrando..." : "Entrar"}
        </button>
      </form>
      <p className={styles.signupHint}>
        Ainda não tem conta?{" "}
        <Link to="/cadastro" className={layoutStyles.link}>
          Criar conta
        </Link>
      </p>
    </AuthLayout>
  );
}

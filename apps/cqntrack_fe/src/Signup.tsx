import { SignupFormSchema } from "@cqntrack/shared";
import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router";
import layoutStyles from "./AuthLayout.module.css";
import { AuthLayout } from "./AuthLayout";
import { authClient } from "./lib/auth-client";
import styles from "./Signup.module.css";

export function Signup() {
  const navigate = useNavigate();
  const { refetch: refetchSession } = authClient.useSession();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = SignupFormSchema.safeParse({ name, username, email, password });
    if (!parsed.success) {
      setError(
        "Preencha nome, um nome de usuário (letras minúsculas, números e _), e-mail válido e uma senha com pelo menos 8 caracteres.",
      );
      return;
    }

    setSubmitting(true);
    const { error: signUpError } = await authClient.signUp.email({
      name: parsed.data.name,
      username: parsed.data.username,
      email: parsed.data.email,
      password: parsed.data.password,
    });
    setSubmitting(false);

    if (signUpError) {
      setError("Não foi possível criar a conta. O e-mail ou nome de usuário já estão em uso.");
      return;
    }

    // Mesmo motivo do Login.tsx: espera a sessão compartilhada refletir o
    // cadastro recém-feito antes de navegar, senão RequireAuth manda de
    // volta pro login por causa do estado velho.
    await refetchSession();
    void navigate("/");
  }

  return (
    <AuthLayout>
      <h1>Criar conta</h1>
      <p className={layoutStyles.subtitle}>Comece a registrar tudo que você consome.</p>
      <form onSubmit={handleSubmit}>
        <label className={styles.field}>
          <span>Nome</span>
          <input
            type="text"
            placeholder="Seu nome"
            autoComplete="name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span>Nome de usuário</span>
          <input
            type="text"
            placeholder="seu_usuario"
            autoComplete="username"
            pattern="[a-z0-9_]+"
            required
            value={username}
            onChange={(event) => setUsername(event.target.value.toLowerCase())}
          />
        </label>
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
            autoComplete="new-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error && (
          <p className={layoutStyles.error} role="alert">
            {error}
          </p>
        )}
        <button className={layoutStyles.btnPrimary} type="submit" disabled={submitting}>
          {submitting ? "Criando conta..." : "Criar conta"}
        </button>
      </form>
      <p className={styles.loginHint}>
        Já tem uma conta?{" "}
        <Link to="/login" className={layoutStyles.link}>
          Entrar
        </Link>
      </p>
    </AuthLayout>
  );
}

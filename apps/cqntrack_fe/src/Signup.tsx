import { SignupFormSchema } from "@cqntrack/shared";
import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router";
import layoutStyles from "./AuthLayout.module.css";
import { AuthLayout } from "./AuthLayout";
import { authClient } from "./lib/auth-client";
import styles from "./Signup.module.css";

interface PasswordFieldProps {
  label: string;
  autoComplete: string;
  value: string;
  onChange: (value: string) => void;
}

function PasswordField({ label, autoComplete, value, onChange }: PasswordFieldProps) {
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

export function Signup() {
  const navigate = useNavigate();
  const { refetch: refetchSession } = authClient.useSession();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [awaitingVerification, setAwaitingVerification] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = SignupFormSchema.safeParse({
      name,
      username,
      email,
      password,
      confirmPassword,
    });
    if (!parsed.success) {
      const mismatch = parsed.error.issues.some((issue) => issue.path[0] === "confirmPassword");
      setError(
        mismatch
          ? "As senhas não coincidem."
          : "Preencha nome, um nome de usuário (letras minúsculas, números e _), e-mail válido e uma senha com pelo menos 8 caracteres.",
      );
      return;
    }

    setSubmitting(true);
    const { data, error: signUpError } = await authClient.signUp.email({
      name: parsed.data.name,
      username: parsed.data.username,
      email: parsed.data.email,
      password: parsed.data.password,
      callbackURL: `${import.meta.env.VITE_WEB_ORIGIN || window.location.origin}/login?verified=1`,
    });
    setSubmitting(false);

    if (signUpError) {
      setError("Não foi possível criar a conta. O e-mail ou nome de usuário já estão em uso.");
      return;
    }

    // Com requireEmailVerification ligado, o cadastro não cria sessão — a
    // API volta com token: null e o usuário só consegue entrar depois de
    // clicar no link mandado por e-mail (ver auth.ts no BE).
    if (!data?.token) {
      setAwaitingVerification(true);
      return;
    }

    // Mesmo motivo do Login.tsx: espera a sessão compartilhada refletir o
    // cadastro recém-feito antes de navegar, senão RequireAuth manda de
    // volta pro login por causa do estado velho.
    await refetchSession();
    void navigate("/");
  }

  if (awaitingVerification) {
    return (
      <AuthLayout>
        <h1>Quase lá!</h1>
        <p className={layoutStyles.subtitle}>
          Mandamos um link de confirmação pro seu e-mail. Clique nele pra ativar sua conta e poder
          entrar.
        </p>
        <p className={layoutStyles.subtitle}>
          Você tem <strong>1 hora</strong> pra confirmar — depois disso o link expira e, se alguém
          mais quiser esse nome de usuário, ele fica disponível de novo.
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
        <PasswordField
          label="Senha"
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
        />
        <PasswordField
          label="Confirmar senha"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={setConfirmPassword}
        />
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

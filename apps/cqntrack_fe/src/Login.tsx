import { type FormEvent, type MouseEvent, useState } from "react";
import layoutStyles from "./AuthLayout.module.css";
import { AuthLayout } from "./AuthLayout";
import styles from "./Login.module.css";

interface LoginProps {
  onNavigateToUnavailable: () => void;
}

export function Login({ onNavigateToUnavailable }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // Autenticação real ainda não existe no backend; formulário só evita o reload padrão por enquanto.
    event.preventDefault();
  }

  function handleUnavailableLinkClick(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    onNavigateToUnavailable();
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
          <a href="#" className={layoutStyles.link} onClick={handleUnavailableLinkClick}>
            Esqueci minha senha
          </a>
        </div>
        <button className={layoutStyles.btnPrimary} type="submit">
          Entrar
        </button>
      </form>
      <p className={styles.signupHint}>
        Ainda não tem conta?{" "}
        <a href="#" className={layoutStyles.link} onClick={handleUnavailableLinkClick}>
          Criar conta
        </a>
      </p>
    </AuthLayout>
  );
}

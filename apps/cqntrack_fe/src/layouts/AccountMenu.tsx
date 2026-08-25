import type { SVGProps } from "react";
import { Link, useNavigate } from "react-router";
import { authClient } from "../lib/auth-client";
import styles from "./AccountMenu.module.css";

function UserIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.5-7 8-7s8 3 8 7" />
    </svg>
  );
}

interface AccountMenuProps {
  // Marcações/listas do dropdown apontam pra seção ativa no momento (mesmo
  // critério de activeMediaType já usado no resto do AppShell).
  sectionPrefix: string;
}

// <details>/<summary> nativo — abre/fecha sem precisar de handler de
// "clicar fora" nem estado próprio; teclado já funciona de graça.
export function AccountMenu({ sectionPrefix }: AccountMenuProps) {
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const username = session?.user?.username;

  async function handleLogout() {
    await authClient.signOut();
    void navigate("/login");
  }

  return (
    <details className={styles.menu}>
      <summary className={styles.trigger} aria-label="Menu da conta">
        {session?.user?.image ? (
          <img className={styles.avatar} src={session.user.image} alt="" />
        ) : (
          <UserIcon className={styles.icon} />
        )}
      </summary>
      <div className={styles.dropdown} role="menu">
        {username && (
          <Link to={`/@${username}`} role="menuitem" className={styles.item}>
            Ver meu perfil
          </Link>
        )}
        <Link to={`${sectionPrefix}/marcacoes`} role="menuitem" className={styles.item}>
          Minhas marcações
        </Link>
        <Link to={`${sectionPrefix}/listas`} role="menuitem" className={styles.item}>
          Minhas listas
        </Link>
        <Link to="/conta" role="menuitem" className={styles.item}>
          Conta
        </Link>
        <button type="button" role="menuitem" className={styles.item} onClick={handleLogout}>
          Sair
        </button>
      </div>
    </details>
  );
}

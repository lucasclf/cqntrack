import type { SVGProps } from "react";
import { NavLink, Outlet } from "react-router";
import { ThemeToggle } from "../ThemeToggle";
import styles from "./AppShell.module.css";

function iconProps(props: SVGProps<SVGSVGElement>): SVGProps<SVGSVGElement> {
  return {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    ...props,
  };
}

function HomeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)}>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}

function SearchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)}>
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function BookmarkIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)}>
      <path d="M6 3h12v18l-6-4-6 4V3z" />
    </svg>
  );
}

function FolderIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
    </svg>
  );
}

// Rotas ainda não implementadas (Commits 8, 10, 11) apontam pra Unavailable,
// mesmo padrão já usado em "/esqueci-senha" — evita links mortos até a
// página real chegar, sem inventar um placeholder novo.
const NAV_ITEMS = [
  { to: "/", label: "Início", Icon: HomeIcon, end: true },
  { to: "/buscar", label: "Buscar", Icon: SearchIcon, end: false },
  { to: "/marcacoes", label: "Marcações", Icon: BookmarkIcon, end: false },
  { to: "/listas", label: "Listas", Icon: FolderIcon, end: false },
] as const;

// Casca da área autenticada: barra de abas no rodapé (mobile) ou sidebar
// (desktop), conforme o mesmo breakpoint de 860px já usado em AuthLayout.
export function AppShell() {
  return (
    <div className={styles.shell}>
      <nav className={styles.nav} aria-label="Navegação principal">
        <div className={styles.brand}>
          <span className={styles.brandMark}>c</span>
          <span className={styles.brandWord}>cqntrack</span>
        </div>
        <ul className={styles.navList}>
          {NAV_ITEMS.map(({ to, label, Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink
                }
              >
                <Icon className={styles.navIcon} />
                <span>{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <ThemeToggle />
      <main className={styles.content}>
        <Outlet />
      </main>
    </div>
  );
}

import { MEDIA_TYPE_LABELS, MEDIA_TYPE_PATH, MEDIA_TYPES, type MediaType } from "@cqntrack/shared";
import type { SVGProps } from "react";
import { Link, NavLink, useLocation } from "react-router";
import { CatMark } from "../CatMark";
import { ThemeToggle } from "../ThemeToggle";
import { AccountMenu } from "./AccountMenu";
import styles from "./TopBar.module.css";

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

function SearchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)}>
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function isInsideSection(pathname: string): boolean {
  return MEDIA_TYPES.some((mediaType) => {
    const prefix = `/${MEDIA_TYPE_PATH[mediaType]}`;
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  });
}

// Fora de uma seção (Início/Conta/perfil público/etc.), assume jogos como
// padrão — é a única escolha razoável sem introduzir "última seção
// acessada" pra um caso que só importa quando o usuário está literalmente
// dentro de uma seção.
function activeMediaType(pathname: string): MediaType {
  const match = MEDIA_TYPES.find((mediaType) => {
    const prefix = `/${MEDIA_TYPE_PATH[mediaType]}`;
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  });
  return match ?? "games";
}

// Pra onde cada item de mídia leva ao clicar no menu — jogos/séries/filmes
// têm tela de "Descobrir" (índice da seção); livros não (Google Books não
// tem endpoint de populares, ver plano) — vai direto pra busca por texto.
function mediaLandingPath(mediaType: MediaType): string {
  const prefix = `/${MEDIA_TYPE_PATH[mediaType]}`;
  return mediaType === "books" ? `${prefix}/buscar` : prefix;
}

// Barra superior (logo, seções, busca contextual, conta) — usada pela
// área autenticada (AppShell) e também por PublicLayout quando o
// visitante de uma tela pública (ex.: /@:username) está logado, pra não
// perder acesso à navegação principal só por estar vendo o perfil de
// outra pessoa.
export function TopBar() {
  const { pathname } = useLocation();
  const sectionPrefix = `/${MEDIA_TYPE_PATH[activeMediaType(pathname)]}`;

  return (
    <header className={styles.topbar}>
      <div className={styles.left}>
        <Link to="/" className={styles.brand}>
          <span className={styles.brandMark}>
            <CatMark className={styles.brandMarkIcon} />
          </span>
          <span className={styles.brandWord}>cqntrack</span>
        </Link>
        <nav className={styles.mediaNav} aria-label="Seções">
          {MEDIA_TYPES.map((mediaType) => {
            const prefix = `/${MEDIA_TYPE_PATH[mediaType]}`;
            const isActive = pathname === prefix || pathname.startsWith(`${prefix}/`);
            return (
              <NavLink
                key={mediaType}
                to={mediaLandingPath(mediaType)}
                className={
                  isActive ? `${styles.mediaLink} ${styles.mediaLinkActive}` : styles.mediaLink
                }
              >
                {MEDIA_TYPE_LABELS[mediaType]}
              </NavLink>
            );
          })}
        </nav>
      </div>

      <div className={styles.right}>
        {isInsideSection(pathname) && (
          <Link to={`${sectionPrefix}/buscar`} className={styles.iconBtn} aria-label="Buscar">
            <SearchIcon className={styles.navIcon} />
          </Link>
        )}
        <ThemeToggle />
        <AccountMenu sectionPrefix={sectionPrefix} />
      </div>
    </header>
  );
}

import { MEDIA_TYPE_PATH, MEDIA_TYPES, type MediaType } from "@cqntrack/shared";
import { Link, NavLink, useLocation } from "react-router";
import { CatMark } from "../CatMark";
import { ThemeToggle } from "../ThemeToggle";
import { AccountMenu } from "./AccountMenu";
import styles from "./TopBar.module.css";

// As 8 opções do header, na ordem pedida (Continuar/Séries/Filmes/Jogos/
// Livros/Mangás/Atividades/Social) — não dá pra derivar isso de
// MEDIA_TYPES (ordem games/series/movies/books/manga, usada noutros
// lugares como os filtros da aba Atividades) sem reordenar aquela lista e
// afetar esses outros usos, então a ordem do header fica hardcoded só
// aqui.
const NAV_ITEMS = [
  { label: "Continuar", to: "/" },
  { label: "Séries", to: "/series" },
  { label: "Filmes", to: "/filmes" },
  { label: "Jogos", to: "/jogos" },
  { label: "Livros", to: "/livros" },
  { label: "Mangás", to: "/mangas" },
  { label: "Atividades", to: "/atividades" },
  { label: "Social", to: "/social" },
];

// Fora de uma seção de mídia (Início/Atividades/Social/Conta/perfil
// público/etc.), assume jogos como padrão — é a única escolha razoável sem
// introduzir "última seção acessada" pra um caso que só importa quando o
// usuário está literalmente dentro de uma seção (usado pelo dropdown de
// conta, "Minhas marcações"/"Minhas listas").
function activeMediaType(pathname: string): MediaType {
  const match = MEDIA_TYPES.find((mediaType) => {
    const prefix = `/${MEDIA_TYPE_PATH[mediaType]}`;
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  });
  return match ?? "games";
}

// Barra superior (logo, as 8 seções, conta) — usada pela área autenticada
// (AppShell) e também por PublicLayout quando o visitante de uma tela
// pública (ex.: /@:username) está logado, pra não perder acesso à
// navegação principal só por estar vendo o perfil de outra pessoa.
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
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                isActive ? `${styles.mediaLink} ${styles.mediaLinkActive}` : styles.mediaLink
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className={styles.right}>
        <ThemeToggle />
        <AccountMenu sectionPrefix={sectionPrefix} />
      </div>
    </header>
  );
}

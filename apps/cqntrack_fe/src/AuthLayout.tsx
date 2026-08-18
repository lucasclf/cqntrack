import type { ReactNode } from "react";
import styles from "./AuthLayout.module.css";
import cat01 from "./assets/collage/cat-01.webp";
import cat02 from "./assets/collage/cat-02.webp";
import cat03 from "./assets/collage/cat-03.webp";
import cat04 from "./assets/collage/cat-04.webp";
import cat05 from "./assets/collage/cat-05.webp";
import cat06 from "./assets/collage/cat-06.webp";
import cat07 from "./assets/collage/cat-07.webp";
import cat08 from "./assets/collage/cat-08.webp";
import cat09 from "./assets/collage/cat-09.webp";
import { CatMark } from "./CatMark";
import { APK_DOWNLOAD_URL } from "./lib/apk-download-url";
import { ThemeToggle } from "./ThemeToggle";

// Fotos dos gatos reais do dono do projeto — cada uma aparece duas vezes
// pra preencher as 18 tiles sem repetir vizinhas (o grid tem 6 colunas, e
// index e index+9 nunca ficam lado a lado).
const COLLAGE_PHOTOS = [cat01, cat02, cat03, cat04, cat05, cat06, cat07, cat08, cat09];
const COLLAGE_TILE_COUNT = COLLAGE_PHOTOS.length * 2;

interface AuthLayoutProps {
  children: ReactNode;
}

// Casca visual compartilhada entre as páginas de autenticação (login, cadastro, erro etc.).
export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className={styles.page}>
      <ThemeToggle className={styles.themeToggle} />

      <aside className={styles.visualPanel}>
        <div className={styles.collage} aria-hidden="true">
          {Array.from({ length: COLLAGE_TILE_COUNT }).map((_, index) => (
            <div
              key={index}
              style={{ backgroundImage: `url(${COLLAGE_PHOTOS[index % COLLAGE_PHOTOS.length]})` }}
            />
          ))}
        </div>
        <div className={styles.scrim} />
        <div className={styles.visualContent}>
          <div className={styles.brand}>
            <span className={styles.brandMark}>
              <CatMark className={styles.brandMarkIcon} />
            </span>
            <span className={styles.brandWord}>cqntrack</span>
          </div>
        </div>
      </aside>

      <main className={styles.formPanel}>
        <div className={styles.formWrap}>
          <div className={`${styles.brand} ${styles.brandCompact}`}>
            <span className={styles.brandMark}>
              <CatMark className={styles.brandMarkIcon} />
            </span>
            <span className={styles.brandWord}>cqntrack</span>
          </div>
          {children}
          {/* Sem sentido dentro do próprio app mobile — só faz sentido pra
              quem está acessando pelo navegador. */}
          {import.meta.env.VITE_TARGET !== "mobile" && (
            <p className={styles.apkLink}>
              Prefere usar no celular?{" "}
              <a href={APK_DOWNLOAD_URL} className={styles.link}>
                Baixe o app Android
              </a>
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

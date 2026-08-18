import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router";
import styles from "./Account.module.css";
import { AvatarUpload } from "./AvatarUpload";
import { ImportFilmowCsv } from "./ImportFilmowCsv";
import { ImportTvTimeCsv } from "./ImportTvTimeCsv";
import { authClient } from "./lib/auth-client";

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function Account() {
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const user = session?.user;

  const [name, setName] = useState(user?.name ?? "");
  const [nameStatus, setNameStatus] = useState<SaveStatus>("idle");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState<SaveStatus>("idle");

  async function handleNameSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNameStatus("saving");
    const { error } = await authClient.updateUser({ name });
    setNameStatus(error ? "error" : "saved");
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordStatus("saving");
    const { error } = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    });
    if (error) {
      setPasswordStatus("error");
      return;
    }
    setPasswordStatus("saved");
    setCurrentPassword("");
    setNewPassword("");
  }

  async function handleLogout() {
    await authClient.signOut();
    void navigate("/login");
  }

  if (!user) {
    return <p>Carregando...</p>;
  }

  return (
    <div className={styles.page}>
      <h1>Minha conta</h1>

      <section className={styles.section}>
        <h2>Perfil</h2>
        <AvatarUpload imageUrl={user.image ?? null} />
        <dl className={styles.info}>
          <div>
            <dt>Nome de usuário</dt>
            <dd>@{user.username ?? "—"}</dd>
          </div>
          <div>
            <dt>E-mail</dt>
            <dd>{user.email}</dd>
          </div>
        </dl>

        <form onSubmit={handleNameSubmit} className={styles.form}>
          <label className={styles.field}>
            <span>Nome de exibição</span>
            <input
              type="text"
              value={name}
              required
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          {nameStatus === "error" && <p role="alert">Falha ao salvar o nome. Tente novamente.</p>}
          {nameStatus === "saved" && <p className={styles.success}>Nome atualizado.</p>}
          <button type="submit" disabled={nameStatus === "saving"}>
            {nameStatus === "saving" ? "Salvando..." : "Salvar nome"}
          </button>
        </form>
      </section>

      <section className={styles.section}>
        <h2>Alterar senha</h2>
        <form onSubmit={handlePasswordSubmit} className={styles.form}>
          <label className={styles.field}>
            <span>Senha atual</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </label>
          <label className={styles.field}>
            <span>Nova senha</span>
            <input
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </label>
          {passwordStatus === "error" && (
            <p role="alert">Senha atual incorreta ou nova senha inválida.</p>
          )}
          {passwordStatus === "saved" && <p className={styles.success}>Senha alterada.</p>}
          <button type="submit" disabled={passwordStatus === "saving"}>
            {passwordStatus === "saving" ? "Salvando..." : "Alterar senha"}
          </button>
        </form>
      </section>

      {/* Fora do build mobile de propósito (ver vite.config.ts,
          VITE_TARGET) — import de CSV não faz parte do app Android. A
          condição é sobre uma constante substituída em build time, então o
          Rollup elimina esse ramo (e os imports abaixo) inteiro do bundle
          mobile, não só esconde visualmente. */}
      {import.meta.env.VITE_TARGET !== "mobile" && (
        <section className={styles.section}>
          <h2>Importar dados</h2>
          <div className={styles.importList}>
            <ImportFilmowCsv />
            <ImportTvTimeCsv />
          </div>
        </section>
      )}

      <section className={styles.section}>
        <button type="button" className={styles.logoutBtn} onClick={handleLogout}>
          Sair da conta
        </button>
      </section>
    </div>
  );
}

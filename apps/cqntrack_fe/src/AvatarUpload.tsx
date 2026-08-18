import { type ChangeEvent, type SVGProps, useState } from "react";
import { apiClient } from "./lib/api-client";
import { authClient } from "./lib/auth-client";
import styles from "./AvatarUpload.module.css";

// Mesmos limites da rota PUT /api/me/avatar (ver app.ts) — validados aqui
// primeiro pra dar feedback imediato sem gastar um request num arquivo que
// o backend ia rejeitar de qualquer forma.
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BYTES = 5 * 1024 * 1024;

type Status = "idle" | "uploading" | "saved" | "error";

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

interface AvatarUploadProps {
  imageUrl: string | null;
}

// "Conta" > "Perfil" — sobe uma única imagem (avatar) pro Cloudinary via
// PUT /api/me/avatar (proxy assinado, ver app.ts/integrations/cloudinary),
// e persiste a URL via authClient.updateUser (mesmo mecanismo já usado
// pra "name" logo acima nesta tela) — isso já propaga a foto nova pro
// resto do app (AccountMenu, perfil público) sozinho, via refresh de
// sessão do better-auth, sem precisar de nenhum estado extra aqui.
export function AvatarUpload({ imageUrl }: AvatarUploadProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setStatus("error");
      setError("Formato não suportado — use JPEG, PNG, WEBP ou GIF.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setStatus("error");
      setError("Imagem muito grande — o limite é 5MB.");
      return;
    }

    setStatus("uploading");
    setError(null);

    try {
      const formData = new FormData();
      formData.set("file", file);
      const { url } = await apiClient.putForm<{ url: string }>("/api/me/avatar", formData);

      const { error: updateError } = await authClient.updateUser({ image: url });
      if (updateError) {
        setStatus("error");
        setError("A imagem subiu, mas falhou ao salvar no perfil. Tente novamente.");
        return;
      }

      setStatus("saved");
    } catch {
      setStatus("error");
      setError("Falha ao enviar a imagem. Tente novamente.");
    }
  }

  return (
    <div className={styles.row}>
      {imageUrl ? (
        <img className={styles.avatar} src={imageUrl} alt="" />
      ) : (
        <div className={styles.placeholder} aria-hidden="true">
          <UserIcon />
        </div>
      )}
      <div className={styles.controls}>
        <label className={styles.fileLabel}>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            disabled={status === "uploading"}
          />
          {status === "uploading" ? "Enviando..." : "Trocar foto"}
        </label>
        {status === "error" && <p role="alert">{error}</p>}
        {status === "saved" && <p className={styles.success}>Foto atualizada.</p>}
        <p className={styles.hint}>JPEG, PNG, WEBP ou GIF, até 5MB.</p>
      </div>
    </div>
  );
}

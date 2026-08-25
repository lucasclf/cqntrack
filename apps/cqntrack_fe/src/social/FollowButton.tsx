import type { FollowStatusResponse } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { apiClient } from "../lib/api-client";
import { authClient } from "../lib/auth-client";
import styles from "./FollowButton.module.css";

interface FollowButtonProps {
  username: string;
}

// Só renderiza pra um visitante logado olhando o perfil de OUTRA pessoa —
// sem sessão, ou vendo o próprio perfil, o botão não faz sentido (ver
// PublicProfile.tsx, único call site). Estado otimista: alterna a UI antes
// da resposta do servidor, reverte se der erro — mesmo espírito do
// "silencioso, mantém estado pra tentar de novo" já usado em
// ActivityFeed.tsx/ContinueWatching.tsx.
export function FollowButton({ username }: FollowButtonProps) {
  const { data: session } = authClient.useSession();
  const [following, setFollowing] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);

  const viewerUsername = session?.user?.username;
  const shouldRender = Boolean(viewerUsername) && viewerUsername !== username;

  useEffect(() => {
    if (!shouldRender) return;

    let cancelled = false;
    apiClient
      .get<FollowStatusResponse>(`/api/social/follow/${username}/status`)
      .then((data) => {
        if (!cancelled) setFollowing(data.following);
      })
      .catch(() => {
        // Silencioso — botão fica no estado "carregando" (null), sem
        // travar o resto da página por causa disso.
      });

    return () => {
      cancelled = true;
    };
  }, [shouldRender, username]);

  if (!shouldRender || following === null) {
    return null;
  }

  async function toggleFollow() {
    const next = !following;
    setFollowing(next);
    setPending(true);
    try {
      if (next) {
        await apiClient.put(`/api/social/follow/${username}`);
      } else {
        await apiClient.delete(`/api/social/follow/${username}`);
      }
    } catch {
      setFollowing(!next); // reverte
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      className={following ? `${styles.button} ${styles.following}` : styles.button}
      onClick={toggleFollow}
      disabled={pending}
    >
      {following ? "Seguindo" : "Seguir"}
    </button>
  );
}

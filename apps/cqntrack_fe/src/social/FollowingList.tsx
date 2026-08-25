import type { FollowedUser, FollowingResponse } from "@cqntrack/shared";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { apiClient } from "../lib/api-client";
import styles from "./FollowingList.module.css";

type LoadStatus = "loading" | "ready" | "error";

// Aba "Listar" da Social — só avatar+nome de quem você segue, clicável pro
// perfil (pedido explícito: nada de ação de deixar de seguir aqui, ver
// FollowButton no próprio perfil público pra isso).
export function FollowingList() {
  const [following, setFollowing] = useState<FollowedUser[]>([]);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<FollowingResponse>("/api/social/following")
      .then((data) => {
        if (!cancelled) {
          setFollowing(data.items);
          setLoadStatus("ready");
        }
      })
      .catch(() => {
        if (!cancelled) setLoadStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loadStatus === "loading") {
    return <p className={styles.hint}>Carregando...</p>;
  }
  if (loadStatus === "error") {
    return <p role="alert">Falha ao carregar sua lista de amigos. Tente novamente.</p>;
  }
  if (following.length === 0) {
    return <p className={styles.hint}>Você ainda não segue ninguém.</p>;
  }

  return (
    <ul className={styles.grid}>
      {following.map((item) => (
        <li key={item.username}>
          <Link to={`/@${item.username}`} className={styles.item}>
            {item.image ? (
              <img className={styles.avatar} src={item.image} alt="" />
            ) : (
              <div className={styles.avatarPlaceholder} aria-hidden="true">
                {item.displayUsername.charAt(0).toUpperCase()}
              </div>
            )}
            <span className={styles.name}>{item.displayUsername}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

import { useState } from "react";
import { SubTabs } from "../components/SubTabs";
import { FollowingList } from "./FollowingList";
import { FriendActivityFeed } from "./FriendActivityFeed";
import styles from "./FriendsPage.module.css";
import { SearchUsers } from "./SearchUsers";

type SocialSubTab = "list" | "activity" | "search";

const TABS = [
  { key: "list" as const, label: "Listar" },
  { key: "activity" as const, label: "Atividades" },
  { key: "search" as const, label: "Procurar" },
];

// Rota /social — 3 abas: Listar (avatar+nome de quem você segue, ver
// FollowingList.tsx), Atividades (feed de quem você segue, ver
// FriendActivityFeed.tsx) e Procurar (diretório de outros usuários +
// busca, ver SearchUsers.tsx — é aqui que dá pra seguir alguém novo).
export function FriendsPage() {
  const [subTab, setSubTab] = useState<SocialSubTab>("list");

  return (
    <div className={styles.page}>
      <h1>Social</h1>
      <SubTabs tabs={TABS} active={subTab} onChange={setSubTab} />

      {subTab === "list" && <FollowingList />}
      {subTab === "activity" && <FriendActivityFeed />}
      {subTab === "search" && <SearchUsers />}
    </div>
  );
}

import { Navigate, useParams } from "react-router";

// URL antiga de antes das rotas ganharem prefixo de seção (/jogos/...) —
// redireciona pra não quebrar links/atalhos já salvos.
export function RedirectToJogosListDetail() {
  const { listId } = useParams();
  return <Navigate to={`/jogos/listas/${listId}`} replace />;
}

import { useNavigate } from "react-router";
import styles from "./BackButton.module.css";

// Volta pra página anterior (histórico do navegador) — usado no topo de cada
// página de detalhe de item pra voltar de onde o usuário veio (busca,
// Descobrir, Minhas marcações, favoritos, listas, etc.), sem precisar saber
// qual dessas rotas foi de fato a origem. Reutilizado pelas 5 seções — mesmo
// texto/comportamento em todas.
export function BackButton() {
  const navigate = useNavigate();
  return (
    <button type="button" className={styles.button} onClick={() => navigate(-1)}>
      ← Voltar
    </button>
  );
}

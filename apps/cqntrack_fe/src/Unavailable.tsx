import layoutStyles from "./AuthLayout.module.css";
import { AuthLayout } from "./AuthLayout";
import unavailableCat from "./assets/unavailable-cat.webp";
import styles from "./Unavailable.module.css";

interface UnavailableProps {
  onBack: () => void;
}

export function Unavailable({ onBack }: UnavailableProps) {
  return (
    <AuthLayout>
      <img
        className={styles.image}
        src={unavailableCat}
        alt="Gato preto e branco com um balão de fala dizendo: Esta função não está disponível!"
      />
      <h1>Ainda não disponível</h1>
      <p className={layoutStyles.subtitle}>
        Essa parte do cqntrack ainda está em construção. Volte para o login e tente novamente mais
        tarde.
      </p>
      <button type="button" className={layoutStyles.btnPrimary} onClick={onBack}>
        Voltar para o login
      </button>
    </AuthLayout>
  );
}

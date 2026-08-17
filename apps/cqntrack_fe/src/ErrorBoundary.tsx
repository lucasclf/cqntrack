import { Component, type ErrorInfo, type ReactNode } from "react";
import styles from "./ErrorBoundary.module.css";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

// Barreira contra exceção de render não tratada — sem isso, um erro em
// qualquer tela (ex.: acessar um campo inesperado de uma resposta) derruba
// a SPA inteira pra tela branca, sem chance de recuperação além de recarregar
// manualmente. Classe porque React ainda não tem equivalente de hook pra
// getDerivedStateFromError/componentDidCatch. Fallback propositalmente
// simples (sem depender de outros componentes/layout/dados) pra minimizar a
// chance de o próprio fallback quebrar.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Erro não tratado na árvore de componentes:", error, info.componentStack);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className={styles.wrapper}>
          <h1>Algo deu errado</h1>
          <p>
            Essa parte da tela quebrou de um jeito inesperado. Recarregar a página deve resolver.
          </p>
          <button type="button" onClick={this.handleReload}>
            Recarregar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

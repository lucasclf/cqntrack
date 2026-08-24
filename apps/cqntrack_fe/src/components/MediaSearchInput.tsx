import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useDebouncedValue } from "../lib/useDebouncedValue";
import styles from "./MediaSearchInput.module.css";

const SEARCH_DEBOUNCE_MS = 300;

type MediaSearchInputProps = {
  sectionPath: string;
  placeholder: string;
  ariaLabel: string;
};

// Campo de busca embutido no topo do Descobrir de cada seção — não duplica
// a lógica de fetch/renderização de resultado, só navega pra página de
// busca da própria seção (que já cuida de tudo) assim que o usuário para
// de digitar.
export function MediaSearchInput({ sectionPath, placeholder, ariaLabel }: MediaSearchInputProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS).trim();

  useEffect(() => {
    if (debouncedQuery) {
      navigate(`${sectionPath}/buscar?q=${encodeURIComponent(debouncedQuery)}`);
    }
  }, [debouncedQuery, navigate, sectionPath]);

  return (
    <input
      type="search"
      className={styles.input}
      placeholder={placeholder}
      value={query}
      onChange={(event) => setQuery(event.target.value)}
      aria-label={ariaLabel}
    />
  );
}

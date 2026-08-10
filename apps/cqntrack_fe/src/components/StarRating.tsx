import type { SVGProps } from "react";
import { useState } from "react";
import styles from "./StarRating.module.css";

interface StarRatingProps {
  value: number | null;
  onChange?: (value: number | null) => void;
}

const STARS = [1, 2, 3, 4, 5] as const;

function StarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 2.5l2.9 6.2 6.7.7-5 4.7 1.4 6.7L12 17.3 6 20.8l1.4-6.7-5-4.7 6.7-.7L12 2.5z" />
    </svg>
  );
}

// Nota de 0 a 5 em passos de 0.5. Cada estrela tem duas metades clicáveis
// (esquerda = meia nota, direita = nota cheia). Clicar na nota já marcada
// remove a nota — favoritar é independente disso (ver GameDetail).
export function StarRating({ value, onChange }: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const readOnly = !onChange;
  const displayValue = hoverValue ?? value ?? 0;

  function fillFraction(starIndex: number): number {
    return Math.max(0, Math.min(1, displayValue - (starIndex - 1)));
  }

  function handleClick(clickedValue: number) {
    onChange?.(clickedValue === value ? null : clickedValue);
  }

  return (
    <div className={styles.stars} aria-label="Nota" onMouseLeave={() => setHoverValue(null)}>
      {STARS.map((starIndex) => (
        <span key={starIndex} className={styles.starSlot}>
          <StarIcon className={styles.starBase} />
          <span
            className={styles.starFillClip}
            style={{ width: `${fillFraction(starIndex) * 100}%` }}
          >
            <StarIcon className={styles.starFill} />
          </span>
          {!readOnly && (
            <>
              <button
                type="button"
                className={styles.starHalfLeft}
                aria-label={`${starIndex - 0.5} estrelas`}
                onMouseEnter={() => setHoverValue(starIndex - 0.5)}
                onClick={() => handleClick(starIndex - 0.5)}
              />
              <button
                type="button"
                className={styles.starHalfRight}
                aria-label={`${starIndex} estrelas`}
                onMouseEnter={() => setHoverValue(starIndex)}
                onClick={() => handleClick(starIndex)}
              />
            </>
          )}
        </span>
      ))}
      {value !== null && <span className={styles.valueLabel}>{value.toFixed(1)}</span>}
    </div>
  );
}

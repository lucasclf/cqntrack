import type { SVGProps } from "react";

// Marca do cqntrack: gato sentado com o rabo enrolado. Usa currentColor pro
// corpo (herda a cor do texto do badge, ver .brandMark em cada layout) e a
// variável --mark-bg pros olhos "vazados" — cada layout define --mark-bg
// igual ao fundo do próprio badge, senão os olhos ficam com a cor errada.
export function CatMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        d="M 17.5 19.5 C 22 19.5 22.5 12.5 18.3 11.2"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.1}
        strokeLinecap="round"
      />
      <ellipse cx={11} cy={18.2} rx={6.2} ry={5.3} fill="currentColor" />
      <circle cx={11} cy={9.6} r={4.6} fill="currentColor" />
      <polygon points="7.4,8.1 6.3,3.6 10.2,6.3" fill="currentColor" />
      <polygon points="14.6,8.1 15.7,3.6 11.8,6.3" fill="currentColor" />
      <circle cx={9.4} cy={9.4} r={0.85} fill="var(--mark-bg)" />
      <circle cx={12.6} cy={9.4} r={0.85} fill="var(--mark-bg)" />
    </svg>
  );
}

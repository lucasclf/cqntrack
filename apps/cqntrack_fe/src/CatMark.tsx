import type { SVGProps } from "react";

// Marca do cqntrack: o gato tuxedo de casa, sentado com o rabo enrolado.
// Usa currentColor pro pelo (herda a cor do texto do badge, ver .brandMark em
// cada layout), --mark-chest pro peito/focinho brancos, --mark-nose pro nariz
// rosa e --mark-bg pros olhos "vazados" — cada layout define --mark-bg igual
// ao fundo do próprio badge, senão os olhos ficam com a cor errada.
// `simple` tira os detalhes pequenos (focinho, nariz, olhos) pra tamanhos
// muito reduzidos, onde eles viram ruído.
interface CatMarkProps extends SVGProps<SVGSVGElement> {
  simple?: boolean;
}

export function CatMark({ simple = false, ...props }: CatMarkProps) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" {...props}>
      <path
        d="M44 55 C56 55 58 39 48 35"
        fill="none"
        stroke="currentColor"
        strokeWidth={5.5}
        strokeLinecap="round"
      />
      <ellipse cx={30} cy={47} rx={16} ry={13.5} fill="currentColor" />
      <circle cx={30} cy={25} r={12} fill="currentColor" />
      <polygon points="20.5,21 18,8 27.5,15" fill="currentColor" />
      <polygon points="39.5,21 42,8 32.5,15" fill="currentColor" />
      <path d="M30 35 C25 41 25 52 30 59 C35 52 35 41 30 35Z" fill="var(--mark-chest, #f5f2ff)" />
      {!simple && (
        <>
          <path
            d="M30 24 C26.5 28 24 31 25 33.5 C27 35.6 33 35.6 35 33.5 C36 31 33.5 28 30 24Z"
            fill="var(--mark-chest, #f5f2ff)"
          />
          <path d="M28.5 28.8 L31.5 28.8 L30 30.7Z" fill="var(--mark-nose, #f4a3b5)" />
          <ellipse cx={24.6} cy={23.4} rx={1.9} ry={1.5} fill="var(--mark-bg)" />
          <ellipse cx={35.4} cy={23.4} rx={1.9} ry={1.5} fill="var(--mark-bg)" />
        </>
      )}
    </svg>
  );
}

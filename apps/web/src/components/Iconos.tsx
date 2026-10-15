import type { ReactNode } from "react";

/** Íconos de trazo de 24×24 que heredan el color del texto. */
function Icono({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      {children}
    </svg>
  );
}

export function IconoLista() {
  return (
    <Icono>
      <path d="M8 6.5h11M8 12h11M8 17.5h11" strokeLinecap="round" />
      <circle cx="4.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="17.5" r="1" fill="currentColor" stroke="none" />
    </Icono>
  );
}

export function IconoCalendario() {
  return (
    <Icono>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 9.5h17" strokeLinecap="round" />
      <path d="M8 3v3M16 3v3" strokeLinecap="round" />
      <circle cx="8.5" cy="14" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="14" r="1" fill="currentColor" stroke="none" />
    </Icono>
  );
}

export function IconoEscudo() {
  return (
    <Icono>
      <path d="M12 3.5l6.5 2.6v5.1c0 4.3-2.7 7.4-6.5 9.3-3.8-1.9-6.5-5-6.5-9.3V6.1L12 3.5z" strokeLinejoin="round" />
      <path d="M9.25 12l1.9 1.9 3.6-3.8" strokeLinecap="round" strokeLinejoin="round" />
    </Icono>
  );
}

export function IconoPersonas() {
  return (
    <Icono>
      <circle cx="9" cy="9" r="3" />
      <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" strokeLinecap="round" />
      <circle cx="17" cy="8" r="2.25" />
      <path d="M15.25 12.5c2.4 0 4.25 1.7 4.25 4.5" strokeLinecap="round" />
    </Icono>
  );
}

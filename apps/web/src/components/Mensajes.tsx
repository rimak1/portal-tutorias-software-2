import type { ReactNode } from "react";

/** Error que el usuario debe ver; los lectores de pantalla lo anuncian de inmediato. */
export function MensajeError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="mensaje-error">
      {children}
    </p>
  );
}

export function MensajeExito({ children }: { children: ReactNode }) {
  return <p className="mensaje-exito">{children}</p>;
}

export function TextoCargando({ children }: { children: ReactNode }) {
  return <p className="texto-cargando">{children}</p>;
}

/** Lo que se muestra mientras un recurso no ha llegado: el error de la carga, o el aviso de que sigue cargando. */
export function EstadoDeCarga({ error, texto }: { error: string | null; texto: string }) {
  return error ? <MensajeError>{error}</MensajeError> : <TextoCargando>{texto}</TextoCargando>;
}

import type { ReactNode } from "react";

export function EstadoVacio({
  icono,
  titulo,
  texto,
}: {
  icono: ReactNode;
  titulo: string;
  texto: string;
}) {
  return (
    <div className="estado-vacio">
      <div className="estado-vacio__icono">{icono}</div>
      <h2>{titulo}</h2>
      <p>{texto}</p>
    </div>
  );
}

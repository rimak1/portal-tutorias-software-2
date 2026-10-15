import { useState } from "react";
import type { FranjaPropia } from "@portal-tutorias/shared";
import { EstadoFranjaBadge } from "../../../components/Insignias";
import { formatearFranja } from "../../../lib/fechas";

interface Props {
  franjas: FranjaPropia[];
  onEditar: (franja: FranjaPropia) => void;
  /** Devuelve true si se eliminó; solo entonces se cierra la confirmación. */
  onEliminar: (franjaId: string) => Promise<boolean>;
}

/** Agenda del tutor. Las franjas libres se pueden editar o eliminar, con confirmación antes de eliminar. */
export function ListaDeFranjas({ franjas, onEditar, onEliminar }: Props) {
  const [confirmando, setConfirmando] = useState<string | null>(null);

  async function eliminar(franjaId: string) {
    if (await onEliminar(franjaId)) setConfirmando(null);
  }

  if (franjas.length === 0) {
    return <p className="texto-cargando">Aún no has publicado franjas vigentes.</p>;
  }

  return (
    <ul className="lista-citas__items">
      {franjas.map((franja) => (
        <li key={franja.id} className="tarjeta-cita">
          <div className="tarjeta-cita__cabecera">
            <span className="tarjeta-cita__materia">{franja.materia}</span>
            <EstadoFranjaBadge estado={franja.estado} />
          </div>
          <span className="tarjeta-cita__horario">{formatearFranja(franja.fechaInicio, franja.fechaFin)}</span>

          {franja.estado === "RESERVADA" ? (
            <p className="tarjeta-cita__nota">Reservada: gestiona la solicitud en «Mis tutorías».</p>
          ) : (
            <div className="tarjeta-cita__acciones">
              {confirmando === franja.id ? (
                <>
                  <span className="tarjeta-cita__nota">¿Eliminar esta franja?</span>
                  <button type="button" className="boton boton--peligro" onClick={() => eliminar(franja.id)}>
                    Sí, eliminar
                  </button>
                  <button type="button" className="boton boton--secundario" onClick={() => setConfirmando(null)}>
                    Conservar
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="boton boton--secundario" onClick={() => onEditar(franja)}>
                    Editar
                  </button>
                  <button type="button" className="boton boton--secundario" onClick={() => setConfirmando(franja.id)}>
                    Eliminar
                  </button>
                </>
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

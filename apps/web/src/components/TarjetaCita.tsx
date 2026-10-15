import type { ReactNode } from "react";
import type { Cita } from "@portal-tutorias/shared";
import type { Vista } from "../lib/acciones-cita";
import { formatearFranja } from "../lib/fechas";
import { EstadoCitaBadge } from "./Insignias";

/**
 * SWR-14: tarjeta de una cita, igual para el estudiante y el tutor salvo el
 * nombre de la contraparte y el aviso de una propuesta pendiente. `children`
 * son los botones de acción.
 */
export function TarjetaCita({
  cita,
  vista,
  children,
}: {
  cita: Cita;
  vista: Vista;
  children?: ReactNode;
}) {
  const horario = formatearFranja(cita.franja.fechaInicio, cita.franja.fechaFin);
  const propuesta = cita.propuestaPendiente;

  return (
    <li className="tarjeta-cita">
      <div className="tarjeta-cita__cabecera">
        <span className="tarjeta-cita__materia">{cita.materia}</span>
        <EstadoCitaBadge estado={cita.estado} />
      </div>
      <span className="tarjeta-cita__persona">
        {vista === "estudiante" ? `Tutor: ${cita.tutor.nombre}` : `Estudiante: ${cita.estudiante.nombre}`}
      </span>
      <span className="tarjeta-cita__horario">{horario}</span>

      {propuesta && (
        <p className="tarjeta-cita__aviso">
          {vista === "estudiante"
            ? "Tu tutor propone reprogramar esta tutoría."
            : "Propusiste otro horario y esperas la respuesta del estudiante."}
          <br />
          Horario original: {formatearFranja(propuesta.franjaOriginal.fechaInicio, propuesta.franjaOriginal.fechaFin)}
          <br />
          Nuevo horario: {horario}
        </p>
      )}

      {cita.estado === "RECHAZADA" && cita.motivoRechazo && (
        <p className="tarjeta-cita__motivo">
          <strong>Motivo del rechazo:</strong> {cita.motivoRechazo}
        </p>
      )}

      {children && <div className="tarjeta-cita__acciones">{children}</div>}
    </li>
  );
}

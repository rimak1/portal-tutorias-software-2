import type { Cita } from "@portal-tutorias/shared";
import type { CitaConRelaciones } from "./citas.puertos.js";

/** Mapper: cita del dominio -> DTO que viaja por la API. */
export function aCita(cita: CitaConRelaciones): Cita {
  const propuesta = cita.propuestas[0];
  return {
    id: cita.id,
    estado: cita.estado,
    motivoRechazo: cita.motivoRechazo,
    materia: cita.franja.materia.nombre,
    tutor: { id: cita.franja.tutor.id, nombre: cita.franja.tutor.nombre },
    estudiante: { id: cita.estudiante.id, nombre: cita.estudiante.nombre },
    franja: {
      id: cita.franja.id,
      fechaInicio: cita.franja.fechaInicio.toISOString(),
      fechaFin: cita.franja.fechaFin.toISOString(),
    },
    propuestaPendiente: propuesta
      ? {
          franjaOriginal: {
            id: propuesta.franjaOriginal.id,
            fechaInicio: propuesta.franjaOriginal.fechaInicio.toISOString(),
            fechaFin: propuesta.franjaOriginal.fechaFin.toISOString(),
          },
        }
      : null,
    creadoEn: cita.creadoEn.toISOString(),
    fechaFinalizacion: cita.fechaFinalizacion?.toISOString() ?? null,
  };
}

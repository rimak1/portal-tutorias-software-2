import type { Disponibilidad, FranjaPropia } from "@portal-tutorias/shared";
import type { FranjaConRelaciones } from "./franjas.puertos.js";

/** Convierte una franja en el DTO `Disponibilidad` que ve cualquier usuario (fechas en ISO 8601). */
export function aDisponibilidad(franja: FranjaConRelaciones): Disponibilidad {
  return {
    id: franja.id,
    materiaId: franja.materia.id,
    materia: franja.materia.nombre,
    fechaInicio: franja.fechaInicio.toISOString(),
    fechaFin: franja.fechaFin.toISOString(),
    tutor: { id: franja.tutor.id, nombre: franja.tutor.nombre },
  };
}

/** Convierte una franja en el DTO `FranjaPropia` que ve su tutor: incluye si está reservada. */
export function aFranjaPropia(franja: FranjaConRelaciones): FranjaPropia {
  return { ...aDisponibilidad(franja), estado: franja.estado };
}

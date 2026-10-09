import type { Disponibilidad, FranjaPropia } from "@portal-tutorias/shared";
import type { FranjaConRelaciones } from "./franjas.repository.js";

/** Mapper: entidad de persistencia -> DTO que viaja por la API (la base de datos no se filtra hacia afuera). */
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

export function aFranjaPropia(franja: FranjaConRelaciones): FranjaPropia {
  return { ...aDisponibilidad(franja), estado: franja.estado };
}

import type { Disponibilidad } from "@portal-tutorias/shared";

export interface TutorConFranjas {
  id: string;
  nombre: string;
  materias: string[];
  franjas: Disponibilidad[];
}

/**
 * Paso 1 de la reserva: agrupa las franjas por tutor. Respeta el orden de
 * llegada, así que si la lista viene ordenada por fecha, la primera franja de
 * cada tutor es su próxima.
 */
export function agruparPorTutor(disponibilidades: Disponibilidad[]): TutorConFranjas[] {
  const porTutor = new Map<string, TutorConFranjas>();

  for (const d of disponibilidades) {
    const actual = porTutor.get(d.tutor.id) ?? { id: d.tutor.id, nombre: d.tutor.nombre, materias: [], franjas: [] };
    if (!actual.materias.includes(d.materia)) actual.materias.push(d.materia);
    actual.franjas.push(d);
    porTutor.set(d.tutor.id, actual);
  }

  return [...porTutor.values()];
}

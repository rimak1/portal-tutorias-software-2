import { solicitudInvalida } from "../../lib/errors.js";

/** SWR-03: el horario de una franja debe ser coherente y comenzar en el futuro. Regla pura: no toca la base de datos. */
export function validarHorario(inicio: Date, fin: Date, ahora: Date): void {
  if (fin <= inicio) {
    throw solicitudInvalida("La hora de fin debe ser posterior a la hora de inicio.");
  }
  if (inicio <= ahora) {
    throw solicitudInvalida("La franja debe comenzar en el futuro.");
  }
}

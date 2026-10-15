import { solicitudInvalida } from "../../lib/errors.js";

/**
 * SWR-03: el horario de una franja termina después de empezar y empieza en el futuro.
 *
 * @throws ErrorDeNegocio 400 si alguna de las dos condiciones no se cumple.
 */
export function validarHorario(inicio: Date, fin: Date, ahora: Date): void {
  if (fin <= inicio) {
    throw solicitudInvalida("La hora de fin debe ser posterior a la hora de inicio.");
  }
  if (inicio <= ahora) {
    throw solicitudInvalida("La franja debe comenzar en el futuro.");
  }
}

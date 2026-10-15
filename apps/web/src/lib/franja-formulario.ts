import type { CrearFranjaInput } from "@portal-tutorias/shared";
import { deCamposLocales } from "./fechas";

export interface CamposDeFranja {
  materiaId: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
}

export type ResultadoDeFormulario = { datos: CrearFranjaInput } | { error: string };

/** SWR-03: convierte lo escrito en el formulario (fecha y horas locales) en los datos de la franja, o explica qué falta. */
export function construirFranja(campos: CamposDeFranja): ResultadoDeFormulario {
  const fechaInicio = deCamposLocales(campos.fecha, campos.horaInicio);
  const fechaFin = deCamposLocales(campos.fecha, campos.horaFin);

  if (!fechaInicio || !fechaFin) {
    return { error: "Completa la fecha y las horas de inicio y de fin." };
  }
  if (new Date(fechaFin) <= new Date(fechaInicio)) {
    return { error: "La hora de fin debe ser posterior a la hora de inicio." };
  }

  return { datos: { materiaId: campos.materiaId, fechaInicio, fechaFin } };
}

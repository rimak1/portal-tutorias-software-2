import type { Cita } from "@portal-tutorias/shared";
import { citasApi } from "./api/citas";

export type AccionDeCita =
  | "aprobar"
  | "rechazar"
  | "reprogramar"
  | "finalizar"
  | "cancelar"
  | "aceptarPropuesta"
  | "rechazarPropuesta";

export type Vista = "estudiante" | "tutor";

/** Acciones que se ejecutan con un solo clic, sin datos adicionales. */
export type AccionSimple = Exclude<AccionDeCita, "rechazar" | "reprogramar">;

export function yaInicio(cita: Cita, ahora: Date): boolean {
  return new Date(cita.franja.fechaInicio) <= ahora;
}

type Regla = (cita: Cita, ahora: Date) => AccionDeCita[];

/**
 * Patron Strategy: que acciones ofrece una cita depende de quien la mira. Cada
 * vista aporta su regla y la interfaz solo las dibuja, de modo que la logica
 * se prueba sin renderizar nada. Espeja las transiciones del backend (RN-006).
 */
const REGLAS: Record<Vista, Regla> = {
  estudiante: (cita) => {
    if (cita.propuestaPendiente) return ["aceptarPropuesta", "rechazarPropuesta"];
    return cita.estado === "PENDIENTE" || cita.estado === "APROBADA" ? ["cancelar"] : [];
  },
  tutor: (cita, ahora) => {
    if (cita.estado === "PENDIENTE" && !cita.propuestaPendiente) return ["aprobar", "rechazar", "reprogramar"];
    if (cita.estado === "APROBADA" && yaInicio(cita, ahora)) return ["finalizar"];
    return [];
  },
};

export function accionesDisponibles(cita: Cita, vista: Vista, ahora: Date = new Date()): AccionDeCita[] {
  return REGLAS[vista](cita, ahora);
}

/** Cada accion simple es un comando: se ejecuta sobre una cita sin que quien la dispara sepa como. */
export const EJECUTORES: Record<AccionSimple, (citaId: string) => Promise<unknown>> = {
  aprobar: citasApi.aprobar,
  finalizar: citasApi.finalizar,
  cancelar: citasApi.cancelar,
  aceptarPropuesta: citasApi.aceptarPropuesta,
  rechazarPropuesta: citasApi.rechazarPropuesta,
};

export const ETIQUETAS: Record<AccionDeCita, string> = {
  aprobar: "Aprobar",
  rechazar: "Rechazar",
  reprogramar: "Proponer otro horario",
  finalizar: "Finalizar tutoría",
  cancelar: "Cancelar tutoría",
  aceptarPropuesta: "Aceptar propuesta",
  rechazarPropuesta: "Rechazar propuesta",
};

const PRIMARIAS: ReadonlySet<AccionDeCita> = new Set(["aprobar", "finalizar", "aceptarPropuesta"]);

export const claseDeBoton = (accion: AccionDeCita): string =>
  PRIMARIAS.has(accion) ? "boton boton--primario" : "boton boton--secundario";

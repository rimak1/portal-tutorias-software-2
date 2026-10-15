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

/** Desde qué lado se mira una cita. */
export type Vista = "estudiante" | "tutor";

/** Acciones que se ejecutan con un solo clic, sin datos adicionales. */
export type AccionSimple = Exclude<AccionDeCita, "rechazar" | "reprogramar">;

export function yaInicio(cita: Cita, ahora: Date): boolean {
  return new Date(cita.franja.fechaInicio) <= ahora;
}

type Regla = (cita: Cita, ahora: Date) => AccionDeCita[];

/**
 * Acciones que se ofrecen en cada vista según el estado de la cita. Deben
 * coincidir con las transiciones que admite el servidor (RN-006): si el
 * servidor rechaza una acción, la interfaz muestra su mensaje.
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

/** Llamada a la API de cada acción simple. */
export const EJECUTORES: Record<AccionSimple, (citaId: string) => Promise<unknown>> = {
  aprobar: citasApi.aprobar,
  finalizar: citasApi.finalizar,
  cancelar: citasApi.cancelar,
  aceptarPropuesta: citasApi.aceptarPropuesta,
  rechazarPropuesta: citasApi.rechazarPropuesta,
};

export function esAccionSimple(accion: AccionDeCita): accion is AccionSimple {
  return accion in EJECUTORES;
}

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

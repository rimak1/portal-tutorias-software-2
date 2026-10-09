import type { Disponibilidad } from "@portal-tutorias/shared";

export type PasoReserva = 1 | 2 | 3;

export interface EstadoReserva {
  paso: PasoReserva;
  materiaId: string;
  tutorId: string | null;
  franja: Disponibilidad | null;
  error: string | null;
}

export const RESERVA_INICIAL: EstadoReserva = { paso: 1, materiaId: "", tutorId: null, franja: null, error: null };

export type EventoReserva =
  | { tipo: "CAMBIAR_MATERIA"; materiaId: string }
  | { tipo: "ELEGIR_TUTOR"; tutorId: string }
  | { tipo: "ELEGIR_FRANJA"; franja: Disponibilidad }
  | { tipo: "VOLVER" }
  | { tipo: "RESERVA_RECHAZADA"; mensaje: string };

/**
 * Patron State aplicado al asistente de reserva (SWR-25): un reductor puro con
 * las unicas transiciones permitidas entre los tres pasos (elegir tutor,
 * elegir franja, confirmar). Un evento que no corresponde al paso actual se
 * ignora, asi que la interfaz no puede quedar en un estado incoherente.
 */
export function reservaReducer(estado: EstadoReserva, evento: EventoReserva): EstadoReserva {
  switch (evento.tipo) {
    case "CAMBIAR_MATERIA":
      return { ...RESERVA_INICIAL, materiaId: evento.materiaId };

    case "ELEGIR_TUTOR":
      return estado.paso === 1 ? { ...estado, paso: 2, tutorId: evento.tutorId, franja: null, error: null } : estado;

    case "ELEGIR_FRANJA":
      return estado.paso === 2 ? { ...estado, paso: 3, franja: evento.franja, error: null } : estado;

    case "VOLVER":
      if (estado.paso === 3) return { ...estado, paso: 2, franja: null, error: null };
      if (estado.paso === 2) return { ...estado, paso: 1, tutorId: null, franja: null, error: null };
      return estado;

    case "RESERVA_RECHAZADA":
      return { ...estado, paso: 2, franja: null, error: evento.mensaje };
  }
}

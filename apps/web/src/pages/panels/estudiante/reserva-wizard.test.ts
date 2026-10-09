import { describe, expect, it } from "vitest";
import type { Disponibilidad } from "@portal-tutorias/shared";
import { RESERVA_INICIAL, reservaReducer, type EstadoReserva, type EventoReserva } from "./reserva-wizard";

const FRANJA: Disponibilidad = {
  id: "00000000-0000-4000-8000-000000000001",
  materiaId: "00000000-0000-4000-8000-000000000002",
  materia: "Bases de Datos",
  fechaInicio: "2026-10-20T15:00:00.000Z",
  fechaFin: "2026-10-20T16:00:00.000Z",
  tutor: { id: "00000000-0000-4000-8000-000000000003", nombre: "Tutor Demo" },
};

const aplicar = (...eventos: EventoReserva[]): EstadoReserva => eventos.reduce(reservaReducer, RESERVA_INICIAL);

describe("SWR-25: reservar en un maximo de 3 pasos (elegir tutor, elegir franja, confirmar)", () => {
  it("elegir tutor y elegir franja llevan al paso de confirmacion: tres pasos en total", () => {
    const paso1 = RESERVA_INICIAL;
    const paso2 = reservaReducer(paso1, { tipo: "ELEGIR_TUTOR", tutorId: FRANJA.tutor.id });
    const paso3 = reservaReducer(paso2, { tipo: "ELEGIR_FRANJA", franja: FRANJA });

    expect([paso1.paso, paso2.paso, paso3.paso]).toEqual([1, 2, 3]);
    expect(paso3.tutorId).toBe(FRANJA.tutor.id);
    expect(paso3.franja).toEqual(FRANJA);
  });

  it("no se puede saltar un paso", () => {
    expect(aplicar({ tipo: "ELEGIR_FRANJA", franja: FRANJA }).paso).toBe(1);
  });

  it("no hay un cuarto paso: elegir de nuevo estando en la confirmacion no avanza", () => {
    const confirmando = aplicar({ tipo: "ELEGIR_TUTOR", tutorId: "t" }, { tipo: "ELEGIR_FRANJA", franja: FRANJA });
    expect(reservaReducer(confirmando, { tipo: "ELEGIR_TUTOR", tutorId: "otro" })).toBe(confirmando);
    expect(reservaReducer(confirmando, { tipo: "ELEGIR_FRANJA", franja: FRANJA })).toBe(confirmando);
  });
});

describe("navegacion del asistente", () => {
  it("volver desde la confirmacion regresa a elegir franja y conserva el tutor", () => {
    const estado = aplicar({ tipo: "ELEGIR_TUTOR", tutorId: "t" }, { tipo: "ELEGIR_FRANJA", franja: FRANJA }, { tipo: "VOLVER" });
    expect(estado).toMatchObject({ paso: 2, tutorId: "t", franja: null });
  });

  it("volver desde elegir franja regresa a elegir tutor y olvida la eleccion", () => {
    const estado = aplicar({ tipo: "ELEGIR_TUTOR", tutorId: "t" }, { tipo: "VOLVER" });
    expect(estado).toMatchObject({ paso: 1, tutorId: null });
  });

  it("volver en el primer paso no hace nada", () => {
    expect(reservaReducer(RESERVA_INICIAL, { tipo: "VOLVER" })).toBe(RESERVA_INICIAL);
  });

  it("cambiar de materia reinicia el asistente y recuerda el filtro", () => {
    const estado = aplicar({ tipo: "ELEGIR_TUTOR", tutorId: "t" }, { tipo: "CAMBIAR_MATERIA", materiaId: "m" });
    expect(estado).toEqual({ ...RESERVA_INICIAL, materiaId: "m" });
  });
});

describe("SWR-09 visto desde la interfaz: otro estudiante gana la franja", () => {
  it("una reserva rechazada regresa a elegir franja con el mensaje del servidor", () => {
    const estado = aplicar(
      { tipo: "ELEGIR_TUTOR", tutorId: "t" },
      { tipo: "ELEGIR_FRANJA", franja: FRANJA },
      { tipo: "RESERVA_RECHAZADA", mensaje: "La franja ya fue reservada por otro estudiante. Elige otra." },
    );

    expect(estado).toMatchObject({ paso: 2, tutorId: "t", franja: null, error: "La franja ya fue reservada por otro estudiante. Elige otra." });
  });

  it("el error se limpia al elegir otra franja", () => {
    const estado = aplicar(
      { tipo: "ELEGIR_TUTOR", tutorId: "t" },
      { tipo: "ELEGIR_FRANJA", franja: FRANJA },
      { tipo: "RESERVA_RECHAZADA", mensaje: "x" },
      { tipo: "ELEGIR_FRANJA", franja: FRANJA },
    );
    expect(estado.error).toBeNull();
  });
});

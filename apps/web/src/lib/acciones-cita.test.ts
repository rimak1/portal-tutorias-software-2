import { describe, expect, it } from "vitest";
import type { Cita, EstadoCita } from "@portal-tutorias/shared";
import { accionesDisponibles, yaInicio } from "./acciones-cita";

const AHORA = new Date("2026-10-20T15:00:00Z");
const hora = (desfaseHoras: number) => new Date(AHORA.getTime() + desfaseHoras * 3600_000).toISOString();

function cita(estado: EstadoCita, extra: { inicioEnHoras?: number; conPropuesta?: boolean } = {}): Cita {
  const inicioEnHoras = extra.inicioEnHoras ?? 24;
  return {
    id: "00000000-0000-4000-8000-000000000001",
    estado,
    motivoRechazo: null,
    materia: "Bases de Datos",
    tutor: { id: "00000000-0000-4000-8000-000000000002", nombre: "Tutor" },
    estudiante: { id: "00000000-0000-4000-8000-000000000003", nombre: "Estudiante" },
    franja: { id: "00000000-0000-4000-8000-000000000004", fechaInicio: hora(inicioEnHoras), fechaFin: hora(inicioEnHoras + 1) },
    propuestaPendiente: extra.conPropuesta
      ? { franjaOriginal: { id: "00000000-0000-4000-8000-000000000005", fechaInicio: hora(48), fechaFin: hora(49) } }
      : null,
    creadoEn: hora(-1),
    fechaFinalizacion: null,
  };
}

describe("acciones que ofrece una cita segun quien la mira (Strategy)", () => {
  describe("vista del estudiante", () => {
    it("una cita Pendiente o Aprobada se puede cancelar", () => {
      expect(accionesDisponibles(cita("PENDIENTE"), "estudiante", AHORA)).toEqual(["cancelar"]);
      expect(accionesDisponibles(cita("APROBADA"), "estudiante", AHORA)).toEqual(["cancelar"]);
    });

    it("con una propuesta de reprogramacion solo puede aceptarla o rechazarla", () => {
      expect(accionesDisponibles(cita("PENDIENTE", { conPropuesta: true }), "estudiante", AHORA)).toEqual([
        "aceptarPropuesta",
        "rechazarPropuesta",
      ]);
    });

    it.each(["RECHAZADA", "CANCELADA", "FINALIZADA"] as const)("una cita %s no ofrece acciones", (estado) => {
      expect(accionesDisponibles(cita(estado), "estudiante", AHORA)).toEqual([]);
    });
  });

  describe("vista del tutor", () => {
    it("una solicitud Pendiente se puede aprobar, rechazar o reprogramar", () => {
      expect(accionesDisponibles(cita("PENDIENTE"), "tutor", AHORA)).toEqual(["aprobar", "rechazar", "reprogramar"]);
    });

    it("con una propuesta enviada espera la respuesta del estudiante", () => {
      expect(accionesDisponibles(cita("PENDIENTE", { conPropuesta: true }), "tutor", AHORA)).toEqual([]);
    });

    it("una cita Aprobada solo se puede finalizar desde su hora de inicio (SWR-13)", () => {
      expect(accionesDisponibles(cita("APROBADA", { inicioEnHoras: 1 }), "tutor", AHORA)).toEqual([]);
      expect(accionesDisponibles(cita("APROBADA", { inicioEnHoras: 0 }), "tutor", AHORA)).toEqual(["finalizar"]);
      expect(accionesDisponibles(cita("APROBADA", { inicioEnHoras: -2 }), "tutor", AHORA)).toEqual(["finalizar"]);
    });

    it.each(["RECHAZADA", "CANCELADA", "FINALIZADA"] as const)("una cita %s no ofrece acciones", (estado) => {
      expect(accionesDisponibles(cita(estado, { inicioEnHoras: -2 }), "tutor", AHORA)).toEqual([]);
    });
  });

  it("yaInicio compara la hora de inicio de la franja con el momento dado", () => {
    expect(yaInicio(cita("APROBADA", { inicioEnHoras: -1 }), AHORA)).toBe(true);
    expect(yaInicio(cita("APROBADA", { inicioEnHoras: 1 }), AHORA)).toBe(false);
  });
});

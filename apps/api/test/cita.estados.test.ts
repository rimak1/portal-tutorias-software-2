import { describe, expect, it } from "vitest";
import { ESTADOS_CITA, type EstadoCita } from "@portal-tutorias/shared";
import { ErrorDeNegocio } from "../src/lib/errors.js";
import { estadoDe, type ContextoCita } from "../src/modules/citas/cita.estados.js";

type Accion = "aprobar" | "rechazar" | "reprogramar" | "aceptarPropuesta" | "rechazarPropuesta" | "cancelar" | "finalizar";
const ACCIONES: Accion[] = ["aprobar", "rechazar", "reprogramar", "aceptarPropuesta", "rechazarPropuesta", "cancelar", "finalizar"];

const AHORA = new Date("2026-10-20T15:00:00Z");
const contexto = (extra: Partial<ContextoCita> = {}): ContextoCita => ({
  tienePropuestaPendiente: false,
  inicioFranja: new Date(AHORA.getTime() + 60 * 60 * 1000),
  ahora: AHORA,
  ...extra,
});

const intentar = (estado: EstadoCita, accion: Accion, ctx = contexto()) => () => estadoDe(estado)[accion](ctx);

describe("RN-006: ciclo de estados de la cita (patron State)", () => {
  it("cada estado se reconoce por su nombre", () => {
    for (const estado of ESTADOS_CITA) {
      expect(estadoDe(estado).nombre).toBe(estado);
    }
  });

  describe("transiciones validas", () => {
    it.each([
      ["PENDIENTE", "aprobar", {}, "APROBADA", false],
      ["PENDIENTE", "rechazar", {}, "RECHAZADA", true],
      ["PENDIENTE", "cancelar", {}, "CANCELADA", true],
      ["PENDIENTE", "reprogramar", {}, "PENDIENTE", true],
      ["PENDIENTE", "aceptarPropuesta", { tienePropuestaPendiente: true }, "APROBADA", false],
      ["PENDIENTE", "rechazarPropuesta", { tienePropuestaPendiente: true }, "CANCELADA", true],
      ["PENDIENTE", "cancelar", { tienePropuestaPendiente: true }, "CANCELADA", true],
      ["APROBADA", "cancelar", {}, "CANCELADA", true],
      ["APROBADA", "finalizar", { inicioFranja: new Date(AHORA.getTime() - 3600_000) }, "FINALIZADA", false],
    ] as const)("%s + %s %j -> %s (libera la franja: %s)", (estado, accion, extra, hacia, libera) => {
      const transicion = estadoDe(estado)[accion](contexto(extra));

      expect(transicion.hacia).toBe(hacia);
      expect(transicion.liberaFranja).toBe(libera);
      expect(transicion.detalle.length).toBeGreaterThan(0);
    });
  });

  describe("RN-007: la franja se libera al cancelar, rechazar o reprogramar", () => {
    it("ninguna transicion que deja la cita activa y confirmada libera la franja", () => {
      expect(estadoDe("PENDIENTE").aprobar(contexto()).liberaFranja).toBe(false);
      expect(estadoDe("APROBADA").finalizar(contexto({ inicioFranja: AHORA })).liberaFranja).toBe(false);
    });
  });

  describe("transiciones invalidas se rechazan con 409", () => {
    it.each(["RECHAZADA", "CANCELADA", "FINALIZADA"] as const)("%s es terminal: no admite ninguna accion", (estado) => {
      for (const accion of ACCIONES) {
        const ejecutar = intentar(estado, accion, contexto({ tienePropuestaPendiente: true }));
        expect(ejecutar, `${estado}.${accion}`).toThrow(ErrorDeNegocio);
        try {
          ejecutar();
        } catch (error) {
          expect((error as ErrorDeNegocio).statusCode).toBe(409);
        }
      }
    });

    it("una cita Aprobada solo se puede cancelar o finalizar", () => {
      for (const accion of ["aprobar", "rechazar", "reprogramar", "aceptarPropuesta", "rechazarPropuesta"] as const) {
        expect(intentar("APROBADA", accion), `APROBADA.${accion}`).toThrow(ErrorDeNegocio);
      }
    });

    it("una cita Pendiente no se puede finalizar", () => {
      expect(intentar("PENDIENTE", "finalizar")).toThrow("Solo se puede finalizar una cita aprobada.");
    });

    it("con una propuesta pendiente no se puede aprobar, rechazar ni reprogramar", () => {
      const conPropuesta = contexto({ tienePropuestaPendiente: true });
      for (const accion of ["aprobar", "rechazar", "reprogramar"] as const) {
        expect(intentar("PENDIENTE", accion, conPropuesta), `PENDIENTE.${accion}`).toThrow("propuesta de reprogramación");
      }
    });

    it("sin propuesta pendiente no hay nada que aceptar ni rechazar", () => {
      expect(intentar("PENDIENTE", "aceptarPropuesta")).toThrow("no tiene una propuesta");
      expect(intentar("PENDIENTE", "rechazarPropuesta")).toThrow("no tiene una propuesta");
    });
  });

  describe("SWR-13: finalizar solo desde la hora de inicio", () => {
    it("antes de la hora de inicio se rechaza", () => {
      expect(intentar("APROBADA", "finalizar", contexto({ inicioFranja: new Date(AHORA.getTime() + 1) }))).toThrow(
        "hora de inicio",
      );
    });

    it("justo en la hora de inicio se permite", () => {
      expect(estadoDe("APROBADA").finalizar(contexto({ inicioFranja: AHORA })).hacia).toBe("FINALIZADA");
    });
  });
});

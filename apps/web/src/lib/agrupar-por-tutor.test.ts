import { describe, expect, it } from "vitest";
import type { Disponibilidad } from "@portal-tutorias/shared";
import { agruparPorTutor } from "./agrupar-por-tutor";

const franja = (id: string, tutorId: string, materia: string, inicio: string): Disponibilidad => ({
  id,
  materiaId: `m-${materia}`,
  materia,
  fechaInicio: inicio,
  fechaFin: inicio,
  tutor: { id: tutorId, nombre: `Tutor ${tutorId}` },
});

describe("agruparPorTutor (paso 1 de la reserva)", () => {
  it("devuelve una lista vacia cuando no hay franjas", () => {
    expect(agruparPorTutor([])).toEqual([]);
  });

  it("agrupa las franjas de cada tutor conservando el orden de llegada", () => {
    const lista = [
      franja("1", "a", "Calculo", "2026-10-20T10:00:00Z"),
      franja("2", "b", "Fisica", "2026-10-20T11:00:00Z"),
      franja("3", "a", "Calculo", "2026-10-21T10:00:00Z"),
    ];

    const tutores = agruparPorTutor(lista);

    expect(tutores.map((t) => t.id)).toEqual(["a", "b"]);
    expect(tutores[0].franjas.map((f) => f.id)).toEqual(["1", "3"]);
    expect(tutores[1].franjas.map((f) => f.id)).toEqual(["2"]);
  });

  it("reune las materias distintas de cada tutor sin repetirlas", () => {
    const tutores = agruparPorTutor([
      franja("1", "a", "Calculo", "2026-10-20T10:00:00Z"),
      franja("2", "a", "Algebra", "2026-10-20T11:00:00Z"),
      franja("3", "a", "Calculo", "2026-10-21T10:00:00Z"),
    ]);

    expect(tutores[0].materias).toEqual(["Calculo", "Algebra"]);
  });

  it("la primera franja de cada tutor es su proxima si la lista llega ordenada por fecha", () => {
    const tutores = agruparPorTutor([
      franja("1", "a", "Calculo", "2026-10-20T10:00:00Z"),
      franja("2", "a", "Calculo", "2026-10-22T10:00:00Z"),
    ]);

    expect(tutores[0].franjas[0].id).toBe("1");
  });
});

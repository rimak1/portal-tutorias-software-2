import { describe, expect, it } from "vitest";
import { construirFranja } from "./franja-formulario";

const CAMPOS = { materiaId: "materia-1", fecha: "2026-10-20", horaInicio: "10:00", horaFin: "11:00" };

describe("construirFranja (SWR-03: fecha, hora de inicio y hora de fin)", () => {
  it("con datos completos y coherentes devuelve la franja con instantes ISO", () => {
    const resultado = construirFranja(CAMPOS);

    expect(resultado).toHaveProperty("datos");
    if (!("datos" in resultado)) return;
    expect(resultado.datos.materiaId).toBe("materia-1");
    expect(new Date(resultado.datos.fechaFin).getTime() - new Date(resultado.datos.fechaInicio).getTime()).toBe(3600_000);
  });

  it.each([
    ["sin fecha", { fecha: "" }],
    ["sin hora de inicio", { horaInicio: "" }],
    ["sin hora de fin", { horaFin: "" }],
  ])("%s pide completar los campos", (_nombre, cambio) => {
    expect(construirFranja({ ...CAMPOS, ...cambio })).toEqual({ error: "Completa la fecha y las horas de inicio y de fin." });
  });

  it("una hora de fin igual o anterior a la de inicio se rechaza", () => {
    const mensaje = { error: "La hora de fin debe ser posterior a la hora de inicio." };

    expect(construirFranja({ ...CAMPOS, horaFin: "10:00" })).toEqual(mensaje);
    expect(construirFranja({ ...CAMPOS, horaFin: "09:30" })).toEqual(mensaje);
  });
});

import { describe, expect, it } from "vitest";
import { etiquetaDeCampana, textoDeContador, tiempoRelativo } from "./notificaciones";

const AHORA = new Date("2026-11-20T12:00:00Z");
const hace = (ms: number) => new Date(AHORA.getTime() - ms).toISOString();
const MIN = 60_000;
const HORA = 60 * MIN;
const DIA = 24 * HORA;

describe("tiempoRelativo (F-07)", () => {
  it.each([
    ["menos de un minuto", 30_000, "ahora"],
    ["un minuto", MIN, "hace 1 min"],
    ["cincuenta y nueve minutos", 59 * MIN, "hace 59 min"],
    ["una hora", HORA, "hace 1 h"],
    ["veintitrés horas", 23 * HORA, "hace 23 h"],
    ["un día", DIA, "ayer"],
    ["casi dos días", 2 * DIA - 1, "ayer"],
    ["tres días", 3 * DIA, "hace 3 días"],
  ])("%s", (_nombre, ms, esperado) => {
    expect(tiempoRelativo(hace(ms), AHORA)).toBe(esperado);
  });

  it("pasado un mes muestra la fecha", () => {
    expect(tiempoRelativo(hace(45 * DIA), AHORA)).toMatch(/2026/);
  });

  it("un instante en el futuro (reloj adelantado) se trata como ahora", () => {
    expect(tiempoRelativo(new Date(AHORA.getTime() + HORA).toISOString(), AHORA)).toBe("ahora");
  });
});

describe("campana de notificaciones", () => {
  it("el contador muestra hasta 9 y luego 9+", () => {
    expect([0, 1, 9, 10, 250].map(textoDeContador)).toEqual(["0", "1", "9", "9+", "9+"]);
  });

  it("la etiqueta accesible dice cuántos avisos hay sin leer", () => {
    expect(etiquetaDeCampana(0)).toBe("Notificaciones, sin avisos nuevos");
    expect(etiquetaDeCampana(1)).toBe("Notificaciones, 1 aviso sin leer");
    expect(etiquetaDeCampana(4)).toBe("Notificaciones, 4 avisos sin leer");
  });
});

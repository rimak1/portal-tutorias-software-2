import { beforeEach, describe, expect, it } from "vitest";
import { LimitadorDeIntentos } from "../src/lib/limitador-de-intentos.js";
import { RelojFijo } from "./fakes.js";

const MINUTO = 60_000;

describe("LimitadorDeIntentos", () => {
  let reloj: RelojFijo;
  let limitador: LimitadorDeIntentos;

  beforeEach(() => {
    reloj = new RelojFijo(new Date("2027-01-01T10:00:00Z"));
    limitador = new LimitadorDeIntentos(3, 10 * MINUTO, reloj);
  });

  const avanzarMinutos = (minutos: number) => reloj.avanzarHoras(minutos / 60);

  it("permite intentar mientras no se alcance el máximo", () => {
    limitador.registrar("a");
    limitador.registrar("a");

    expect(limitador.esperaPara("a")).toBe(0);
  });

  it("al alcanzar el máximo indica cuánto falta para que venza el intento más antiguo", () => {
    limitador.registrar("a");
    avanzarMinutos(2);
    limitador.registrar("a");
    limitador.registrar("a");

    // El primer intento se hizo hace 2 minutos y vence a los 10: faltan 8.
    expect(limitador.esperaPara("a")).toBe(8 * MINUTO);
  });

  it("vuelve a permitir cuando el intento más antiguo sale de la ventana", () => {
    for (let i = 0; i < 3; i++) limitador.registrar("a");
    expect(limitador.esperaPara("a")).toBeGreaterThan(0);

    avanzarMinutos(10);

    expect(limitador.esperaPara("a")).toBe(0);
  });

  it("la ventana es deslizante: los intentos vencen de a uno", () => {
    limitador.registrar("a");
    avanzarMinutos(4);
    limitador.registrar("a");
    avanzarMinutos(4);
    limitador.registrar("a");
    expect(limitador.esperaPara("a")).toBe(2 * MINUTO);

    avanzarMinutos(2); // vence el primero: quedan 2 intentos vigentes
    expect(limitador.esperaPara("a")).toBe(0);
  });

  it("cada clave lleva su propia cuenta", () => {
    for (let i = 0; i < 3; i++) limitador.registrar("a");

    expect(limitador.esperaPara("a")).toBeGreaterThan(0);
    expect(limitador.esperaPara("b")).toBe(0);
  });

  it("reiniciar olvida los intentos de la clave", () => {
    for (let i = 0; i < 3; i++) limitador.registrar("a");

    limitador.reiniciar("a");

    expect(limitador.esperaPara("a")).toBe(0);
  });

  it("no acumula claves que ya no tienen intentos vigentes", () => {
    for (let i = 0; i < 100; i++) limitador.registrar(`clave-${i}`);
    avanzarMinutos(11);

    for (let i = 0; i < 600; i++) limitador.esperaPara("otra");

    expect((limitador as unknown as { intentos: Map<string, number[]> }).intentos.size).toBe(0);
  });
});

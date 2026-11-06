import { describe, expect, it } from "vitest";
import type { Cuenta } from "@portal-tutorias/shared";
import { construirCuenta, filtrarCuentas, generarPasswordInicial } from "./cuentas";

const CAMPOS = { correo: "  Nora@UQ.edu.co ", nombre: "  Nora Nueva ", rol: "TUTOR", password: "ClaveInicial1" } as const;

describe("construirCuenta (F-08)", () => {
  it("con datos válidos devuelve la cuenta con el correo en minúsculas y el nombre sin espacios sobrantes", () => {
    expect(construirCuenta(CAMPOS)).toEqual({ datos: { correo: "nora@uq.edu.co", nombre: "Nora Nueva", rol: "TUTOR", password: "ClaveInicial1" } });
  });

  it.each([
    ["correo inválido", { correo: "no-es-correo" }, "Ingresa un correo válido."],
    ["nombre muy corto", { nombre: "N" }, "El nombre debe tener al menos 2 caracteres."],
    ["contraseña corta", { password: "corta" }, "La contraseña debe tener al menos 8 caracteres."],
  ])("%s", (_nombre, cambio, mensaje) => {
    expect(construirCuenta({ ...CAMPOS, ...cambio })).toEqual({ error: mensaje });
  });
});

const cuenta = (nombre: string, correo: string, rol: Cuenta["rol"], activo = true): Cuenta => ({
  id: correo,
  nombre,
  correo,
  rol,
  activo,
  creadoEn: "2026-11-01T00:00:00.000Z",
});

describe("filtrarCuentas", () => {
  const cuentas = [
    cuenta("Ángela Gómez", "angela@uq.edu.co", "TUTOR"),
    cuenta("Carlos Pérez", "carlos@uq.edu.co", "ESTUDIANTE"),
    cuenta("Marta Ríos", "marta@uq.edu.co", "TUTOR", false),
  ];
  const sinFiltro = { texto: "", rol: "", estado: "" } as const;

  it("sin filtro devuelve todas", () => {
    expect(filtrarCuentas(cuentas, sinFiltro)).toHaveLength(3);
  });

  it("el texto busca en nombre y correo sin distinguir mayúsculas ni tildes", () => {
    expect(filtrarCuentas(cuentas, { ...sinFiltro, texto: "angela" }).map((c) => c.nombre)).toEqual(["Ángela Gómez"]);
    expect(filtrarCuentas(cuentas, { ...sinFiltro, texto: "PEREZ" }).map((c) => c.nombre)).toEqual(["Carlos Pérez"]);
    expect(filtrarCuentas(cuentas, { ...sinFiltro, texto: "marta@" }).map((c) => c.nombre)).toEqual(["Marta Ríos"]);
  });

  it("filtra por rol y por estado, y se combinan", () => {
    expect(filtrarCuentas(cuentas, { ...sinFiltro, rol: "TUTOR" })).toHaveLength(2);
    expect(filtrarCuentas(cuentas, { ...sinFiltro, estado: "desactivadas" }).map((c) => c.nombre)).toEqual(["Marta Ríos"]);
    expect(filtrarCuentas(cuentas, { ...sinFiltro, rol: "TUTOR", estado: "activas" }).map((c) => c.nombre)).toEqual(["Ángela Gómez"]);
    expect(filtrarCuentas(cuentas, { ...sinFiltro, rol: "ESTUDIANTE", estado: "desactivadas" })).toEqual([]);
  });
});

describe("generarPasswordInicial", () => {
  it("genera 12 caracteres sin los que se confunden al leerlos", () => {
    const aleatorios = (n: number) => Uint32Array.from({ length: n }, (_, i) => i * 7919);

    const password = generarPasswordInicial(aleatorios);

    expect(password).toHaveLength(12);
    expect(password).not.toMatch(/[0O1lI]/);
  });

  it("con el generador real cumple el mínimo que exige la API y no se repite", () => {
    const a = generarPasswordInicial();
    const b = generarPasswordInicial();

    expect(a.length).toBeGreaterThanOrEqual(8);
    expect(a).not.toBe(b);
    expect(construirCuenta({ ...CAMPOS, password: a })).toHaveProperty("datos");
  });
});

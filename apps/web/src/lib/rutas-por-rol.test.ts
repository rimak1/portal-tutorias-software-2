import { describe, expect, it } from "vitest";
import { ROLES } from "@portal-tutorias/shared";
import { rutaPanelPorRol } from "./rutas-por-rol";

describe("SWR-02: redirigir al usuario al panel de su rol", () => {
  it("cada rol tiene un panel propio y distinto", () => {
    const rutas = ROLES.map((rol) => rutaPanelPorRol(rol));
    expect(new Set(rutas).size).toBe(ROLES.length);
  });

  it.each([
    ["ESTUDIANTE", "/estudiante"],
    ["TUTOR", "/tutor"],
    ["COORDINADOR", "/coordinador"],
    ["ADMINISTRADOR", "/administrador"],
  ] as const)("el rol %s va a %s", (rol, ruta) => {
    expect(rutaPanelPorRol(rol)).toBe(ruta);
  });
});

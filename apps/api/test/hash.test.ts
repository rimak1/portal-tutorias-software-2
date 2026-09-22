import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../src/lib/hash.js";

describe("hashPassword / verifyPassword (RNF-001)", () => {
  it("nunca guarda la contrasena en texto plano", async () => {
    const hash = await hashPassword("MiClaveSegura123");
    expect(hash).not.toContain("MiClaveSegura123");
    expect(hash.startsWith("$argon2id$")).toBe(true);
  });

  it("verifica correctamente una contrasena valida", async () => {
    const hash = await hashPassword("MiClaveSegura123");
    await expect(verifyPassword(hash, "MiClaveSegura123")).resolves.toBe(true);
  });

  it("rechaza una contrasena incorrecta", async () => {
    const hash = await hashPassword("MiClaveSegura123");
    await expect(verifyPassword(hash, "OtraClave")).resolves.toBe(false);
  });

  it("no lanza excepcion con un hash corrupto", async () => {
    await expect(verifyPassword("no-es-un-hash-valido", "cualquier")).resolves.toBe(false);
  });
});

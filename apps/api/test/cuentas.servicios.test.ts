import { beforeEach, describe, expect, it } from "vitest";
import type { CifradoDePasswords } from "../src/modules/auth/auth.puertos.js";
import { GestionDeCuentasService } from "../src/modules/usuarios/gestion-de-cuentas.service.js";
import { MundoEnMemoria } from "./fakes.js";

/** Cifrado sin costo: lo que se prueba aquí son las reglas de administración, no argon2. */
const cifradoDePrueba: CifradoDePasswords = {
  cifrar: async (password) => `hash(${password})`,
  verificar: async (hash, password) => hash === `hash(${password})`,
};

const ADMIN = { id: "admin-1", rol: "ADMINISTRADOR" } as const;
const COORDINADOR = { id: "coord-1", rol: "COORDINADOR" } as const;

describe("GestionDeCuentasService (F-08)", () => {
  let mundo: MundoEnMemoria;
  let servicio: GestionDeCuentasService;

  beforeEach(() => {
    mundo = new MundoEnMemoria();
    mundo.agregarCuenta({ id: "admin-1", rol: "ADMINISTRADOR", nombre: "Ada Admin", correo: "ada@uq.edu.co" });
    mundo.agregarCuenta({ id: "coord-1", rol: "COORDINADOR", nombre: "Carlos Coordinador", correo: "carlos@uq.edu.co" });
    mundo.agregarCuenta({ id: "tutor-1", rol: "TUTOR", nombre: "Tomás Tutor", correo: "tomas@uq.edu.co" });
    mundo.agregarCuenta({ id: "est-1", rol: "ESTUDIANTE", nombre: "Elena Estudiante", correo: "elena@uq.edu.co" });
    servicio = new GestionDeCuentasService(mundo, cifradoDePrueba);
  });

  describe("listar", () => {
    it("el administrador ve todas las cuentas, ordenadas por nombre, y puede filtrar", async () => {
      expect((await servicio.listar(ADMIN, {})).map((c) => c.nombre)).toEqual(["Ada Admin", "Carlos Coordinador", "Elena Estudiante", "Tomás Tutor"]);
      expect((await servicio.listar(ADMIN, { rol: "ESTUDIANTE" })).map((c) => c.id)).toEqual(["est-1"]);
      expect((await servicio.listar(ADMIN, { q: "TOMAS" })).map((c) => c.id)).toEqual(["tutor-1"]);
    });

    it("filtra por estado de la cuenta", async () => {
      mundo.datos.cuentas.get("est-1")!.activo = false;

      expect((await servicio.listar(ADMIN, { activo: false })).map((c) => c.id)).toEqual(["est-1"]);
      expect(await servicio.listar(ADMIN, { activo: true, rol: "ESTUDIANTE" })).toEqual([]);
    });

    it("el coordinador solo ve tutores, aunque el filtro pida otro rol", async () => {
      expect((await servicio.listar(COORDINADOR, {})).map((c) => c.id)).toEqual(["tutor-1"]);
      expect((await servicio.listar(COORDINADOR, { rol: "ADMINISTRADOR" })).map((c) => c.id)).toEqual(["tutor-1"]);
    });

    it("nunca expone el hash de la contraseña", async () => {
      const [cuenta] = await servicio.listar(ADMIN, { rol: "TUTOR" });

      expect(Object.keys(cuenta).sort()).toEqual(["activo", "correo", "creadoEn", "id", "nombre", "rol"]);
    });
  });

  describe("crear", () => {
    const datos = { correo: "nueva@uq.edu.co", nombre: "Nora Nueva", rol: "TUTOR", password: "ClaveInicial1" } as const;

    it("crea la cuenta con la contraseña cifrada y registra quién la creó", async () => {
      const cuenta = await servicio.crear(ADMIN, datos);

      expect(cuenta).toMatchObject({ correo: "nueva@uq.edu.co", nombre: "Nora Nueva", rol: "TUTOR", activo: true });
      const guardada = mundo.datos.cuentas.get(cuenta.id)!;
      expect(guardada.passwordHash).toBe("hash(ClaveInicial1)");
      expect(guardada.creadoPorId).toBe("admin-1");
    });

    it("rechaza un correo que ya tiene cuenta", async () => {
      await expect(servicio.crear(ADMIN, { ...datos, correo: "elena@uq.edu.co" })).rejects.toMatchObject({ statusCode: 409 });
    });

    it("el coordinador puede registrar tutores, pero no otros roles", async () => {
      await expect(servicio.crear(COORDINADOR, datos)).resolves.toMatchObject({ rol: "TUTOR" });

      for (const rol of ["ESTUDIANTE", "COORDINADOR", "ADMINISTRADOR"] as const) {
        await expect(servicio.crear(COORDINADOR, { ...datos, correo: `${rol}@uq.edu.co`, rol })).rejects.toMatchObject({ statusCode: 403 });
      }
    });
  });

  describe("actualizar", () => {
    it("cambia el nombre, desactiva y reactiva una cuenta", async () => {
      expect(await servicio.actualizar(ADMIN, "est-1", { nombre: "Elena E." })).toMatchObject({ nombre: "Elena E.", activo: true });
      expect(await servicio.actualizar(ADMIN, "est-1", { activo: false })).toMatchObject({ activo: false });
      expect(await servicio.actualizar(ADMIN, "est-1", { activo: true })).toMatchObject({ activo: true });
    });

    it("restablece la contraseña guardando solo su hash", async () => {
      await servicio.actualizar(ADMIN, "est-1", { password: "NuevaClave123" });

      expect(mundo.datos.cuentas.get("est-1")!.passwordHash).toBe("hash(NuevaClave123)");
    });

    it("una cuenta inexistente es un 404", async () => {
      await expect(servicio.actualizar(ADMIN, "fantasma", { activo: false })).rejects.toMatchObject({ statusCode: 404 });
    });

    it("no permite que el administrador desactive su propia cuenta", async () => {
      mundo.agregarCuenta({ id: "admin-2", rol: "ADMINISTRADOR", nombre: "Otro Admin" });

      await expect(servicio.actualizar(ADMIN, "admin-1", { activo: false })).rejects.toMatchObject({ statusCode: 409 });
      expect(mundo.datos.cuentas.get("admin-1")!.activo).toBe(true);
    });

    it("el administrador que queda como único activo no puede desactivarse", async () => {
      mundo.agregarCuenta({ id: "admin-2", rol: "ADMINISTRADOR", nombre: "Otro Admin" });
      mundo.datos.cuentas.get("admin-1")!.activo = false;
      const otro = { id: "admin-2", rol: "ADMINISTRADOR" } as const;
      mundo.agregarCuenta({ id: "admin-3", rol: "ADMINISTRADOR", nombre: "Tercer Admin" });

      // admin-2 desactiva a admin-3: queda admin-2, activo.
      await expect(servicio.actualizar(otro, "admin-3", { activo: false })).resolves.toMatchObject({ activo: false });
      // Ahora admin-2 es el único activo: otro administrador no podría quitarlo, y él no puede quitarse a sí mismo.
      await expect(servicio.actualizar(otro, "admin-2", { activo: false })).rejects.toMatchObject({ statusCode: 409 });
      expect(mundo.datos.cuentas.get("admin-2")!.activo).toBe(true);
    });

    it("sí permite desactivar a un administrador si queda otro activo", async () => {
      mundo.agregarCuenta({ id: "admin-2", rol: "ADMINISTRADOR", nombre: "Otro Admin" });

      await expect(servicio.actualizar(ADMIN, "admin-2", { activo: false })).resolves.toMatchObject({ activo: false });
    });

    it("no permite desactivar al último administrador activo, y lo explica", async () => {
      mundo.agregarCuenta({ id: "admin-2", rol: "ADMINISTRADOR", nombre: "Otro Admin" });
      mundo.datos.cuentas.get("admin-1")!.activo = false;

      // El actor es otro usuario que no es administrador activo (p. ej. ya fue desactivado): el único activo es admin-2.
      await expect(servicio.actualizar({ id: "admin-1", rol: "ADMINISTRADOR" }, "admin-2", { activo: false })).rejects.toThrow(
        "Debe quedar al menos un administrador activo.",
      );
    });

    it("un cambio rechazado no deja efectos parciales (se revierte la transacción)", async () => {
      mundo.agregarCuenta({ id: "admin-2", rol: "ADMINISTRADOR", nombre: "Otro Admin" });
      mundo.datos.cuentas.get("admin-1")!.activo = false;
      const antes = mundo.datos.cuentas.get("admin-2")!.passwordHash;

      await expect(servicio.actualizar({ id: "x", rol: "ADMINISTRADOR" }, "admin-2", { activo: false, password: "OtraClave123" })).rejects.toThrow();

      expect(mundo.datos.cuentas.get("admin-2")!.passwordHash).toBe(antes);
    });
  });
});

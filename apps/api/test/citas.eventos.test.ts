import { describe, expect, it, vi } from "vitest";
import type { Repositorios } from "../src/db/unidad-de-trabajo.js";
import { CambiosDeCita, registrarEnHistorial, type CambioDeEstadoDeCita } from "../src/modules/citas/citas.eventos.js";

const CAMBIO: CambioDeEstadoDeCita = {
  citaId: "cita-1",
  estadoAnterior: "PENDIENTE",
  estadoNuevo: "APROBADA",
  actorId: "tutor-1",
  detalle: "Solicitud aprobada",
};

const repos = {} as Repositorios;

describe("CambiosDeCita (patron Observer)", () => {
  it("avisa a cada suscriptor, en el orden en que se suscribieron, con el cambio y los repositorios de la transaccion", async () => {
    const llamadas: string[] = [];
    const cambios = new CambiosDeCita();
    cambios.suscribir(async (cambio, r) => {
      llamadas.push(`primero:${cambio.citaId}`);
      expect(r).toBe(repos);
    });
    cambios.suscribir(async () => {
      llamadas.push("segundo");
    });

    await cambios.publicar(CAMBIO, repos);

    expect(llamadas).toEqual(["primero:cita-1", "segundo"]);
  });

  it("publicar sin suscriptores no hace nada", async () => {
    await expect(new CambiosDeCita().publicar(CAMBIO, repos)).resolves.toBeUndefined();
  });

  it("un suscriptor puede darse de baja", async () => {
    const suscriptor = vi.fn(async () => {});
    const cambios = new CambiosDeCita();
    const darDeBaja = cambios.suscribir(suscriptor);

    darDeBaja();
    await cambios.publicar(CAMBIO, repos);

    expect(suscriptor).not.toHaveBeenCalled();
  });

  it("si un suscriptor falla el error se propaga (la transaccion se revierte) y los siguientes no se ejecutan", async () => {
    const siguiente = vi.fn(async () => {});
    const cambios = new CambiosDeCita();
    cambios.suscribir(async () => {
      throw new Error("fallo al registrar");
    });
    cambios.suscribir(siguiente);

    await expect(cambios.publicar(CAMBIO, repos)).rejects.toThrow("fallo al registrar");
    expect(siguiente).not.toHaveBeenCalled();
  });
});

describe("registrarEnHistorial (BR-04)", () => {
  it("guarda el cambio de estado en la bitacora a traves del repositorio de citas", async () => {
    const registrarHistorial = vi.fn(async () => {});
    const fake = { citas: { registrarHistorial } } as unknown as Repositorios;

    await registrarEnHistorial(CAMBIO, fake);

    expect(registrarHistorial).toHaveBeenCalledWith(CAMBIO);
  });
});

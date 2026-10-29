import { describe, expect, it } from "vitest";
import type { Cliente } from "../src/db/cliente.js";
import { FranjasRepository } from "../src/modules/disponibilidad/franjas.repository.js";
import { FranjaTraslapada } from "../src/modules/disponibilidad/franjas.puertos.js";

/** Mensajes tal como Prisma reporta cada error de PostgreSQL al crear una franja. */
const VIOLACION_DE_EXCLUSION =
  'PostgresError { code: "23P01", message: "conflicting key value violates exclusion constraint \\"disponibilidad_sin_traslape\\"" }';
const INTERBLOQUEO = 'PostgresError { code: "40P01", message: "deadlock detected" }';
const OTRO_ERROR = 'PostgresError { code: "23503", message: "insert or update violates foreign key constraint" }';

const repositorioQueFallaCon = (mensaje: string) =>
  new FranjasRepository({ disponibilidad: { create: () => Promise.reject(new Error(mensaje)) } } as unknown as Cliente);

const DATOS = { tutorId: "t-1", materiaId: "m-1", fechaInicio: new Date(), fechaFin: new Date() };

describe("FranjasRepository.crear: traduccion de errores de PostgreSQL (SWR-04)", () => {
  it("la violacion de la restriccion de traslape se reporta como FranjaTraslapada", async () => {
    await expect(repositorioQueFallaCon(VIOLACION_DE_EXCLUSION).crear(DATOS)).rejects.toBeInstanceOf(FranjaTraslapada);
  });

  it("el interbloqueo entre creaciones simultaneas que se cruzan tambien es FranjaTraslapada, no un error 500", async () => {
    await expect(repositorioQueFallaCon(INTERBLOQUEO).crear(DATOS)).rejects.toBeInstanceOf(FranjaTraslapada);
  });

  it("cualquier otro error de la base de datos se propaga sin traducir", async () => {
    await expect(repositorioQueFallaCon(OTRO_ERROR).crear(DATOS)).rejects.not.toBeInstanceOf(FranjaTraslapada);
  });
});

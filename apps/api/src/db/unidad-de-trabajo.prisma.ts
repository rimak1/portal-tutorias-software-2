import type { PrismaClient } from "@prisma/client";
import { CitasRepository } from "../modules/citas/citas.repository.js";
import { FranjasRepository } from "../modules/disponibilidad/franjas.repository.js";
import { MateriasRepository } from "../modules/materias/materias.repository.js";
import { UsuariosRepository } from "../modules/usuarios/usuarios.repository.js";
import type { Cliente } from "./cliente.js";
import type { Repositorios, UnidadDeTrabajo } from "./puertos.js";

/** Repositorios Prisma sobre un cliente: el global o el de una transacción en curso. */
export function crearRepositorios(db: Cliente): Repositorios {
  return {
    usuarios: new UsuariosRepository(db),
    materias: new MateriasRepository(db),
    franjas: new FranjasRepository(db),
    citas: new CitasRepository(db),
  };
}

/**
 * Transacciones interactivas de Prisma. Las reglas que combinan varias
 * escrituras (RN-002, RN-004, RN-006 y RN-007) se confirman o se revierten juntas.
 */
export class UnidadDeTrabajoPrisma implements UnidadDeTrabajo {
  readonly repos: Repositorios;

  constructor(private readonly prisma: PrismaClient) {
    this.repos = crearRepositorios(prisma);
  }

  ejecutar<T>(trabajo: (repos: Repositorios) => Promise<T>): Promise<T> {
    return this.prisma.$transaction((tx) => trabajo(crearRepositorios(tx)));
  }
}

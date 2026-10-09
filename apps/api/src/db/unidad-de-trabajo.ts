import type { PrismaClient } from "@prisma/client";
import { CitasRepository } from "../modules/citas/citas.repository.js";
import { FranjasRepository } from "../modules/disponibilidad/franjas.repository.js";
import { MateriasRepository } from "../modules/materias/materias.repository.js";
import { UsuariosRepository } from "../modules/usuarios/usuarios.repository.js";
import type { Cliente } from "./cliente.js";

export interface Repositorios {
  usuarios: UsuariosRepository;
  materias: MateriasRepository;
  franjas: FranjasRepository;
  citas: CitasRepository;
}

/** Fabrica: arma el conjunto de repositorios sobre un cliente (global o transaccional). */
export function crearRepositorios(db: Cliente): Repositorios {
  return {
    usuarios: new UsuariosRepository(db),
    materias: new MateriasRepository(db),
    franjas: new FranjasRepository(db),
    citas: new CitasRepository(db),
  };
}

/**
 * Unit of Work: `ejecutar` abre una transaccion y entrega repositorios ligados a
 * ella, de modo que todo lo que haga el caso de uso se confirma o se revierte
 * junto (reglas RN-002, RN-004, RN-006 y RN-007 dependen de ello). `repos`
 * son los repositorios sin transaccion, para consultas simples.
 */
export class UnidadDeTrabajo {
  readonly repos: Repositorios;

  constructor(private readonly prisma: PrismaClient) {
    this.repos = crearRepositorios(prisma);
  }

  ejecutar<T>(trabajo: (repos: Repositorios) => Promise<T>): Promise<T> {
    return this.prisma.$transaction((tx) => trabajo(crearRepositorios(tx)));
  }
}

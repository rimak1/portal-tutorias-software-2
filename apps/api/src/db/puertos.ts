import type { RepositorioDeCitas } from "../modules/citas/citas.puertos.js";
import type { RepositorioDeFranjas } from "../modules/disponibilidad/franjas.puertos.js";
import type { RepositorioDeMaterias } from "../modules/materias/materias.puertos.js";
import type { RepositorioDeUsuarios } from "../modules/usuarios/usuarios.puertos.js";

export interface Repositorios {
  usuarios: RepositorioDeUsuarios;
  materias: RepositorioDeMaterias;
  franjas: RepositorioDeFranjas;
  citas: RepositorioDeCitas;
}

/**
 * Puerto de la unidad de trabajo: `ejecutar` corre el caso de uso de forma
 * atomica con repositorios ligados a la misma transaccion; `repos` sirve para
 * consultas simples. Los servicios dependen de esta abstraccion, no de Prisma.
 */
export interface UnidadDeTrabajo {
  readonly repos: Repositorios;
  ejecutar<T>(trabajo: (repos: Repositorios) => Promise<T>): Promise<T>;
}

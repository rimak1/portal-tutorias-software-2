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

/** Acceso a los repositorios, con o sin transacción. */
export interface UnidadDeTrabajo {
  /** Repositorios fuera de transacción, para consultas que no necesitan atomicidad. */
  readonly repos: Repositorios;
  /**
   * Ejecuta `trabajo` en una transacción con repositorios ligados a ella: si
   * `trabajo` lanza, ninguno de sus cambios se confirma y el error se propaga.
   */
  ejecutar<T>(trabajo: (repos: Repositorios) => Promise<T>): Promise<T>;
}

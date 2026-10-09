import type { Materia } from "@portal-tutorias/shared";
import type { UnidadDeTrabajo } from "../../db/unidad-de-trabajo.js";
import { conflicto, solicitudInvalida } from "../../lib/errors.js";

export class MateriasService {
  constructor(private readonly uow: UnidadDeTrabajo) {}

  /** Catalogo de materias o areas de tutoria. */
  listarCatalogo(): Promise<Materia[]> {
    return this.uow.repos.materias.listarCatalogo();
  }

  /** SWR-20: materias asociadas al perfil de un tutor. */
  listarDeTutor(tutorId: string): Promise<Materia[]> {
    return this.uow.repos.materias.listarDeTutor(tutorId);
  }

  /**
   * SWR-20: reemplaza las materias del perfil del tutor. No permite quitar una
   * materia con franjas vigentes publicadas, para que el perfil y la agenda coincidan.
   */
  async reemplazarDeTutor(tutorId: string, materiaIds: string[]): Promise<Materia[]> {
    const ids = [...new Set(materiaIds)];

    return this.uow.ejecutar(async ({ materias }) => {
      if ((await materias.contarExistentes(ids)) !== ids.length) {
        throw solicitudInvalida("Alguna de las materias seleccionadas no existe.");
      }

      const retirada = await materias.buscarMateriaConFranjasVigentesFueraDe(tutorId, ids);
      if (retirada) {
        throw conflicto(`No puedes quitar «${retirada}» porque tienes franjas vigentes con esa materia.`);
      }

      await materias.reemplazarDeTutor(tutorId, ids);
      return materias.listarDeTutor(tutorId);
    });
  }
}

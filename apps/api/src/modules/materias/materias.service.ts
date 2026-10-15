import type { Materia } from "@portal-tutorias/shared";
import type { UnidadDeTrabajo } from "../../db/puertos.js";
import { conflicto, solicitudInvalida } from "../../lib/errors.js";
import type { Reloj } from "../../lib/reloj.js";

/** F-10: catálogo de materias y materias que cada tutor declara en su perfil. */
export class MateriasService {
  constructor(
    private readonly uow: UnidadDeTrabajo,
    private readonly reloj: Reloj,
  ) {}

  /** Catálogo completo de materias, en orden alfabético. */
  listarCatalogo(): Promise<Materia[]> {
    return this.uow.repos.materias.listarCatalogo();
  }

  /** SWR-20: materias del perfil del tutor, en orden alfabético. */
  listarDeTutor(tutorId: string): Promise<Materia[]> {
    return this.uow.repos.materias.listarDeTutor(tutorId);
  }

  /**
   * SWR-20: reemplaza las materias del perfil del tutor. No permite quitar una
   * materia con franjas vigentes, para que el perfil y la agenda coincidan.
   *
   * @returns Las materias del perfil después del cambio.
   * @throws ErrorDeNegocio 400 si alguna materia no existe en el catálogo.
   * @throws ErrorDeNegocio 409 si se quita una materia con franjas vigentes.
   */
  async reemplazarDeTutor(tutorId: string, materiaIds: string[]): Promise<Materia[]> {
    const ids = [...new Set(materiaIds)];

    return this.uow.ejecutar(async ({ materias }) => {
      if ((await materias.contarExistentes(ids)) !== ids.length) {
        throw solicitudInvalida("Alguna de las materias seleccionadas no existe.");
      }

      const retirada = await materias.buscarMateriaConFranjasVigentesFueraDe(tutorId, ids, this.reloj.ahora());
      if (retirada) {
        throw conflicto(`No puedes quitar «${retirada}» porque tienes franjas vigentes con esa materia.`);
      }

      await materias.reemplazarDeTutor(tutorId, ids);
      return materias.listarDeTutor(tutorId);
    });
  }
}

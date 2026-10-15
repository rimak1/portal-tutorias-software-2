import type { Materia } from "@portal-tutorias/shared";

export interface RepositorioDeMaterias {
  /** Catálogo completo, en orden alfabético. */
  listarCatalogo(): Promise<Materia[]>;
  /** Materias del perfil del tutor, en orden alfabético. */
  listarDeTutor(tutorId: string): Promise<Materia[]>;
  /** Cuántos de los ids existen en el catálogo. */
  contarExistentes(materiaIds: string[]): Promise<number>;
  tutorImparte(tutorId: string, materiaId: string): Promise<boolean>;
  /** Nombre de alguna materia con franjas del tutor que terminan desde `desde` y que NO está en `materiaIds`, o null. */
  buscarMateriaConFranjasVigentesFueraDe(tutorId: string, materiaIds: string[], desde: Date): Promise<string | null>;
  /** Deja en el perfil del tutor exactamente las materias de `materiaIds`. */
  reemplazarDeTutor(tutorId: string, materiaIds: string[]): Promise<void>;
}

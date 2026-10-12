import type { Materia } from "@portal-tutorias/shared";

export interface RepositorioDeMaterias {
  listarCatalogo(): Promise<Materia[]>;
  listarDeTutor(tutorId: string): Promise<Materia[]>;
  contarExistentes(materiaIds: string[]): Promise<number>;
  tutorImparte(tutorId: string, materiaId: string): Promise<boolean>;
  /** Nombre de una materia con franjas vigentes desde `desde` que NO esta en `materiaIds`, si existe. */
  buscarMateriaConFranjasVigentesFueraDe(tutorId: string, materiaIds: string[], desde: Date): Promise<string | null>;
  reemplazarDeTutor(tutorId: string, materiaIds: string[]): Promise<void>;
}

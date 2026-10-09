import type { Materia } from "@portal-tutorias/shared";
import type { Cliente } from "../../db/cliente.js";

/** Repositorio del catalogo de materias y de las materias que imparte cada tutor. */
export class MateriasRepository {
  constructor(private readonly db: Cliente) {}

  listarCatalogo(): Promise<Materia[]> {
    return this.db.materia.findMany({ select: { id: true, nombre: true }, orderBy: { nombre: "asc" } });
  }

  async listarDeTutor(tutorId: string): Promise<Materia[]> {
    const asociaciones = await this.db.tutorMateria.findMany({
      where: { tutorId },
      select: { materia: { select: { id: true, nombre: true } } },
    });
    return asociaciones.map((a) => a.materia).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }

  contarExistentes(materiaIds: string[]): Promise<number> {
    return this.db.materia.count({ where: { id: { in: materiaIds } } });
  }

  async tutorImparte(tutorId: string, materiaId: string): Promise<boolean> {
    const asociacion = await this.db.tutorMateria.findUnique({ where: { tutorId_materiaId: { tutorId, materiaId } } });
    return asociacion !== null;
  }

  /** Nombre de una materia que el tutor tiene en franjas vigentes y que NO esta en `materiaIds`, si existe. */
  async buscarMateriaConFranjasVigentesFueraDe(tutorId: string, materiaIds: string[]): Promise<string | null> {
    const franja = await this.db.disponibilidad.findFirst({
      where: { tutorId, eliminadaEn: null, fechaFin: { gte: new Date() }, materiaId: { notIn: materiaIds } },
      select: { materia: { select: { nombre: true } } },
    });
    return franja?.materia.nombre ?? null;
  }

  async reemplazarDeTutor(tutorId: string, materiaIds: string[]): Promise<void> {
    await this.db.tutorMateria.deleteMany({ where: { tutorId, materiaId: { notIn: materiaIds } } });
    await this.db.tutorMateria.createMany({
      data: materiaIds.map((materiaId) => ({ tutorId, materiaId })),
      skipDuplicates: true,
    });
  }
}

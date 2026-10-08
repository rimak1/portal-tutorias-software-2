import type { PrismaClient } from "@prisma/client";
import type { Materia } from "@portal-tutorias/shared";
import { conflicto, solicitudInvalida } from "../../lib/errors.js";

export class MateriasService {
  constructor(private readonly prisma: PrismaClient) {}

  /** Catalogo de materias o areas de tutoria. */
  async listarCatalogo(): Promise<Materia[]> {
    return this.prisma.materia.findMany({
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    });
  }

  /** SWR-20: materias asociadas al perfil de un tutor. */
  async listarDeTutor(tutorId: string): Promise<Materia[]> {
    const asociaciones = await this.prisma.tutorMateria.findMany({
      where: { tutorId },
      select: { materia: { select: { id: true, nombre: true } } },
    });
    return asociaciones.map((a) => a.materia).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }

  /**
   * SWR-20: reemplaza las materias del perfil del tutor. No permite quitar una
   * materia con franjas vigentes publicadas, para que el perfil y la agenda coincidan.
   */
  async reemplazarDeTutor(tutorId: string, materiaIds: string[]): Promise<Materia[]> {
    const ids = [...new Set(materiaIds)];

    const existentes = await this.prisma.materia.count({ where: { id: { in: ids } } });
    if (existentes !== ids.length) {
      throw solicitudInvalida("Alguna de las materias seleccionadas no existe.");
    }

    const retiradasConFranjas = await this.prisma.disponibilidad.findFirst({
      where: {
        tutorId,
        eliminadaEn: null,
        fechaFin: { gte: new Date() },
        materiaId: { notIn: ids },
      },
      select: { materia: { select: { nombre: true } } },
    });
    if (retiradasConFranjas) {
      throw conflicto(
        `No puedes quitar «${retiradasConFranjas.materia.nombre}» porque tienes franjas vigentes con esa materia.`,
      );
    }

    await this.prisma.$transaction([
      this.prisma.tutorMateria.deleteMany({ where: { tutorId, materiaId: { notIn: ids } } }),
      this.prisma.tutorMateria.createMany({
        data: ids.map((materiaId) => ({ tutorId, materiaId })),
        skipDuplicates: true,
      }),
    ]);

    return this.listarDeTutor(tutorId);
  }
}

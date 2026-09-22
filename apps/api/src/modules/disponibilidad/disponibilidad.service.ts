import type { PrismaClient } from "@prisma/client";
import type { Disponibilidad } from "@portal-tutorias/shared";

export class DisponibilidadService {
  constructor(private readonly prisma: PrismaClient) {}

  /** RF-004: consulta de franjas futuras publicadas por tutores activos. */
  async listarProximas(): Promise<Disponibilidad[]> {
    const disponibilidades = await this.prisma.disponibilidad.findMany({
      where: {
        fechaInicio: { gte: new Date() },
        tutor: { activo: true },
      },
      orderBy: { fechaInicio: "asc" },
      include: { tutor: { select: { id: true, nombre: true } } },
    });

    return disponibilidades.map((disponibilidad) => ({
      id: disponibilidad.id,
      materia: disponibilidad.materia,
      fechaInicio: disponibilidad.fechaInicio.toISOString(),
      fechaFin: disponibilidad.fechaFin.toISOString(),
      tutor: {
        id: disponibilidad.tutor.id,
        nombre: disponibilidad.tutor.nombre,
      },
    }));
  }
}

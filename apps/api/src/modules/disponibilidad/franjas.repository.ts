import type { Prisma } from "@prisma/client";
import type { EstadoFranja } from "@portal-tutorias/shared";
import type { Cliente } from "../../db/cliente.js";

export const INCLUDE_FRANJA = {
  materia: { select: { id: true, nombre: true } },
  tutor: { select: { id: true, nombre: true } },
} satisfies Prisma.DisponibilidadInclude;

export type FranjaConRelaciones = Prisma.DisponibilidadGetPayload<{ include: typeof INCLUDE_FRANJA }>;

export interface FranjaBloqueadaParaReserva {
  estado: EstadoFranja;
  fechaInicio: Date;
  tutorActivo: boolean;
}

export interface FranjaBloqueadaParaReprogramar {
  estado: EstadoFranja;
  fechaInicio: Date;
  tutorId: string;
}

/**
 * Repositorio de franjas de disponibilidad. Los metodos `bloquear*` toman la
 * fila con SELECT ... FOR UPDATE y por eso solo tienen sentido dentro de una
 * transaccion (ver UnidadDeTrabajo).
 */
export class FranjasRepository {
  constructor(private readonly db: Cliente) {}

  /** SWR-06 / SWR-07: franjas libres, vigentes y de tutores activos, por fecha, con filtros opcionales. */
  listarLibresProximas(filtros: { tutorId?: string; materiaId?: string }): Promise<FranjaConRelaciones[]> {
    return this.db.disponibilidad.findMany({
      where: {
        estado: "LIBRE",
        eliminadaEn: null,
        fechaInicio: { gte: new Date() },
        tutor: { activo: true },
        ...(filtros.tutorId ? { tutorId: filtros.tutorId } : {}),
        ...(filtros.materiaId ? { materiaId: filtros.materiaId } : {}),
      },
      orderBy: { fechaInicio: "asc" },
      include: INCLUDE_FRANJA,
    });
  }

  listarVigentesDeTutor(tutorId: string): Promise<FranjaConRelaciones[]> {
    return this.db.disponibilidad.findMany({
      where: { tutorId, eliminadaEn: null, fechaFin: { gte: new Date() } },
      orderBy: { fechaInicio: "asc" },
      include: INCLUDE_FRANJA,
    });
  }

  crear(datos: { tutorId: string; materiaId: string; fechaInicio: Date; fechaFin: Date }): Promise<FranjaConRelaciones> {
    return this.db.disponibilidad.create({ data: datos, include: INCLUDE_FRANJA });
  }

  actualizar(id: string, datos: { materiaId: string; fechaInicio: Date; fechaFin: Date }): Promise<FranjaConRelaciones> {
    return this.db.disponibilidad.update({ where: { id }, data: datos, include: INCLUDE_FRANJA });
  }

  cargar(id: string) {
    return this.db.disponibilidad.findUniqueOrThrow({ where: { id } });
  }

  async marcarEliminada(id: string): Promise<void> {
    await this.db.disponibilidad.update({ where: { id }, data: { eliminadaEn: new Date() } });
  }

  async cambiarEstado(id: string, estado: EstadoFranja): Promise<void> {
    await this.db.disponibilidad.update({ where: { id }, data: { estado } });
  }

  /** Verificacion previa de traslape; las franjas contiguas (fin == inicio) no se consideran traslapadas. */
  async existeTraslape(tutorId: string, inicio: Date, fin: Date, ignorarFranjaId?: string): Promise<boolean> {
    const traslapada = await this.db.disponibilidad.findFirst({
      where: {
        tutorId,
        eliminadaEn: null,
        fechaInicio: { lt: fin },
        fechaFin: { gt: inicio },
        ...(ignorarFranjaId ? { id: { not: ignorarFranjaId } } : {}),
      },
      select: { id: true },
    });
    return traslapada !== null;
  }

  /** Bloquea una franja propia no eliminada y devuelve su estado, o null si no existe. */
  async bloquearDelTutor(tutorId: string, franjaId: string): Promise<EstadoFranja | null> {
    const filas = await this.db.$queryRaw<{ estado: EstadoFranja }[]>`
      SELECT "estado"::text AS "estado"
      FROM "disponibilidad"
      WHERE "id" = ${franjaId}::uuid AND "tutor_id" = ${tutorId}::uuid AND "eliminada_en" IS NULL
      FOR UPDATE`;
    return filas[0]?.estado ?? null;
  }

  /** Bloquea la franja que se va a reservar, junto con el estado de la cuenta de su tutor. */
  async bloquearParaReserva(franjaId: string): Promise<FranjaBloqueadaParaReserva | null> {
    const filas = await this.db.$queryRaw<{ estado: EstadoFranja; fecha_inicio: Date; tutor_activo: boolean }[]>`
      SELECT d."estado"::text AS "estado", d."fecha_inicio" AS "fecha_inicio", u."activo" AS "tutor_activo"
      FROM "disponibilidad" d
      JOIN "usuario" u ON u."id" = d."tutor_id"
      WHERE d."id" = ${franjaId}::uuid AND d."eliminada_en" IS NULL
      FOR UPDATE OF d`;
    const fila = filas[0];
    return fila ? { estado: fila.estado, fechaInicio: fila.fecha_inicio, tutorActivo: fila.tutor_activo } : null;
  }

  /** Bloquea la franja que el tutor propone como nuevo horario. */
  async bloquearParaReprogramar(franjaId: string): Promise<FranjaBloqueadaParaReprogramar | null> {
    const filas = await this.db.$queryRaw<{ estado: EstadoFranja; fecha_inicio: Date; tutor_id: string }[]>`
      SELECT "estado"::text AS "estado", "fecha_inicio", "tutor_id"
      FROM "disponibilidad"
      WHERE "id" = ${franjaId}::uuid AND "eliminada_en" IS NULL
      FOR UPDATE`;
    const fila = filas[0];
    return fila ? { estado: fila.estado, fechaInicio: fila.fecha_inicio, tutorId: fila.tutor_id } : null;
  }
}

import type { Prisma } from "@prisma/client";
import type { EstadoFranja } from "@portal-tutorias/shared";
import type { Cliente } from "../../db/cliente.js";
import { violaExclusion } from "../../db/errores-postgres.js";
import {
  FranjaTraslapada,
  type DatosDeFranja,
  type FranjaBloqueadaParaReprogramar,
  type FranjaBloqueadaParaReserva,
  type FranjaConRelaciones,
  type RepositorioDeFranjas,
} from "./franjas.puertos.js";

/** Restricción de exclusión: un tutor no puede tener dos franjas que se crucen. */
const RESTRICCION_SIN_TRASLAPE = "disponibilidad_sin_traslape";

const INCLUDE_FRANJA = {
  materia: { select: { id: true, nombre: true } },
  tutor: { select: { id: true, nombre: true } },
} satisfies Prisma.DisponibilidadInclude;

/** Ejecuta una escritura y traduce la violación de la restricción de traslape a FranjaTraslapada. */
async function sinTraslape<T>(escritura: Promise<T>): Promise<T> {
  try {
    return await escritura;
  } catch (error) {
    if (violaExclusion(error, RESTRICCION_SIN_TRASLAPE)) throw new FranjaTraslapada();
    throw error;
  }
}

/**
 * Franjas de disponibilidad sobre Prisma. Los métodos `bloquear*` usan
 * SELECT ... FOR UPDATE y por eso solo tienen efecto dentro de una transacción.
 */
export class FranjasRepository implements RepositorioDeFranjas {
  constructor(private readonly db: Cliente) {}

  listarLibresProximas(filtros: { tutorId?: string; materiaId?: string }, desde: Date): Promise<FranjaConRelaciones[]> {
    return this.db.disponibilidad.findMany({
      where: {
        estado: "LIBRE",
        eliminadaEn: null,
        fechaInicio: { gte: desde },
        tutor: { activo: true },
        ...(filtros.tutorId ? { tutorId: filtros.tutorId } : {}),
        ...(filtros.materiaId ? { materiaId: filtros.materiaId } : {}),
      },
      orderBy: { fechaInicio: "asc" },
      include: INCLUDE_FRANJA,
    });
  }

  listarVigentesDeTutor(tutorId: string, desde: Date): Promise<FranjaConRelaciones[]> {
    return this.db.disponibilidad.findMany({
      where: { tutorId, eliminadaEn: null, fechaFin: { gte: desde } },
      orderBy: { fechaInicio: "asc" },
      include: INCLUDE_FRANJA,
    });
  }

  crear(datos: DatosDeFranja & { tutorId: string }): Promise<FranjaConRelaciones> {
    return sinTraslape(this.db.disponibilidad.create({ data: datos, include: INCLUDE_FRANJA }));
  }

  actualizar(id: string, datos: DatosDeFranja): Promise<FranjaConRelaciones> {
    return sinTraslape(this.db.disponibilidad.update({ where: { id }, data: datos, include: INCLUDE_FRANJA }));
  }

  cargar(id: string): Promise<DatosDeFranja> {
    return this.db.disponibilidad.findUniqueOrThrow({ where: { id } });
  }

  async marcarEliminada(id: string, cuando: Date): Promise<void> {
    await this.db.disponibilidad.update({ where: { id }, data: { eliminadaEn: cuando } });
  }

  async cambiarEstado(id: string, estado: EstadoFranja): Promise<void> {
    await this.db.disponibilidad.update({ where: { id }, data: { estado } });
  }

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

  async bloquearDelTutor(tutorId: string, franjaId: string): Promise<EstadoFranja | null> {
    const filas = await this.db.$queryRaw<{ estado: EstadoFranja }[]>`
      SELECT "estado"::text AS "estado"
      FROM "disponibilidad"
      WHERE "id" = ${franjaId}::uuid AND "tutor_id" = ${tutorId}::uuid AND "eliminada_en" IS NULL
      FOR UPDATE`;
    return filas[0]?.estado ?? null;
  }

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

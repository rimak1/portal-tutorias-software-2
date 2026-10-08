import { Prisma, type PrismaClient } from "@prisma/client";
import type {
  ActualizarFranjaInput,
  CrearFranjaInput,
  Disponibilidad,
  FranjaPropia,
} from "@portal-tutorias/shared";
import { conflicto, esViolacionDeTraslape, noEncontrado, solicitudInvalida } from "../../lib/errors.js";

type Cliente = PrismaClient | Prisma.TransactionClient;

const INCLUDE_FRANJA = {
  materia: { select: { id: true, nombre: true } },
  tutor: { select: { id: true, nombre: true } },
} satisfies Prisma.DisponibilidadInclude;

type FranjaConRelaciones = Prisma.DisponibilidadGetPayload<{ include: typeof INCLUDE_FRANJA }>;

const MENSAJE_TRASLAPE = "La franja se traslapa con otra de tu agenda.";
const MENSAJE_RESERVADA =
  "Esta franja ya está reservada: gestiona primero la cita asociada.";

function aDisponibilidad(franja: FranjaConRelaciones): Disponibilidad {
  return {
    id: franja.id,
    materiaId: franja.materia.id,
    materia: franja.materia.nombre,
    fechaInicio: franja.fechaInicio.toISOString(),
    fechaFin: franja.fechaFin.toISOString(),
    tutor: { id: franja.tutor.id, nombre: franja.tutor.nombre },
  };
}

function aFranjaPropia(franja: FranjaConRelaciones): FranjaPropia {
  return { ...aDisponibilidad(franja), estado: franja.estado };
}

export class DisponibilidadService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * SWR-06 / SWR-07: franjas libres y vigentes de tutores activos, ordenadas por
   * fecha y hora, con filtro opcional por tutor y por materia.
   */
  async listarProximas(filtros: { tutorId?: string; materiaId?: string } = {}): Promise<Disponibilidad[]> {
    const franjas = await this.prisma.disponibilidad.findMany({
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

    return franjas.map(aDisponibilidad);
  }

  /** Agenda propia del tutor: franjas vigentes en cualquier estado. */
  async listarDeTutor(tutorId: string): Promise<FranjaPropia[]> {
    const franjas = await this.prisma.disponibilidad.findMany({
      where: { tutorId, eliminadaEn: null, fechaFin: { gte: new Date() } },
      orderBy: { fechaInicio: "asc" },
      include: INCLUDE_FRANJA,
    });

    return franjas.map(aFranjaPropia);
  }

  /** SWR-03 y SWR-04: crea una franja con fecha, hora de inicio y de fin, sin traslapes. */
  async crear(tutorId: string, entrada: CrearFranjaInput): Promise<FranjaPropia> {
    const inicio = new Date(entrada.fechaInicio);
    const fin = new Date(entrada.fechaFin);
    this.validarHorario(inicio, fin);
    await this.exigirMateriaDelPerfil(this.prisma, tutorId, entrada.materiaId);
    await this.exigirSinTraslape(this.prisma, tutorId, inicio, fin);

    try {
      const franja = await this.prisma.disponibilidad.create({
        data: { tutorId, materiaId: entrada.materiaId, fechaInicio: inicio, fechaFin: fin },
        include: INCLUDE_FRANJA,
      });
      return aFranjaPropia(franja);
    } catch (error) {
      // Dos solicitudes simultaneas pueden pasar la verificacion previa; la base de datos decide.
      if (esViolacionDeTraslape(error)) throw conflicto(MENSAJE_TRASLAPE);
      throw error;
    }
  }

  /** RN-003: solo se modifica una franja que no esta reservada. */
  async actualizar(tutorId: string, franjaId: string, cambios: ActualizarFranjaInput): Promise<FranjaPropia> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.bloquearFranjaLibreDelTutor(tx, tutorId, franjaId);

        const actual = await tx.disponibilidad.findUniqueOrThrow({ where: { id: franjaId } });
        const inicio = cambios.fechaInicio ? new Date(cambios.fechaInicio) : actual.fechaInicio;
        const fin = cambios.fechaFin ? new Date(cambios.fechaFin) : actual.fechaFin;
        const materiaId = cambios.materiaId ?? actual.materiaId;

        this.validarHorario(inicio, fin);
        if (materiaId !== actual.materiaId) {
          await this.exigirMateriaDelPerfil(tx, tutorId, materiaId);
        }
        await this.exigirSinTraslape(tx, tutorId, inicio, fin, franjaId);

        const franja = await tx.disponibilidad.update({
          where: { id: franjaId },
          data: { materiaId, fechaInicio: inicio, fechaFin: fin },
          include: INCLUDE_FRANJA,
        });
        return aFranjaPropia(franja);
      });
    } catch (error) {
      if (esViolacionDeTraslape(error)) throw conflicto(MENSAJE_TRASLAPE);
      throw error;
    }
  }

  /**
   * SWR-05: elimina una franja que aun no ha sido reservada. La eliminacion es
   * logica: las citas anteriores (rechazadas o canceladas) conservan su referencia.
   */
  async eliminar(tutorId: string, franjaId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.bloquearFranjaLibreDelTutor(tx, tutorId, franjaId);
      await tx.disponibilidad.update({ where: { id: franjaId }, data: { eliminadaEn: new Date() } });
    });
  }

  private validarHorario(inicio: Date, fin: Date): void {
    if (fin <= inicio) {
      throw solicitudInvalida("La hora de fin debe ser posterior a la hora de inicio.");
    }
    if (inicio <= new Date()) {
      throw solicitudInvalida("La franja debe comenzar en el futuro.");
    }
  }

  private async exigirMateriaDelPerfil(cliente: Cliente, tutorId: string, materiaId: string): Promise<void> {
    const asociada = await cliente.tutorMateria.findUnique({
      where: { tutorId_materiaId: { tutorId, materiaId } },
    });
    if (!asociada) {
      throw solicitudInvalida("Esa materia no está en tu perfil. Agrégala primero en «Mis materias».");
    }
  }

  /** Verificacion previa de traslape; las franjas contiguas (fin == inicio) no se consideran traslapadas. */
  private async exigirSinTraslape(
    cliente: Cliente,
    tutorId: string,
    inicio: Date,
    fin: Date,
    ignorarFranjaId?: string,
  ): Promise<void> {
    const traslapada = await cliente.disponibilidad.findFirst({
      where: {
        tutorId,
        eliminadaEn: null,
        fechaInicio: { lt: fin },
        fechaFin: { gt: inicio },
        ...(ignorarFranjaId ? { id: { not: ignorarFranjaId } } : {}),
      },
      select: { id: true },
    });
    if (traslapada) {
      throw conflicto(MENSAJE_TRASLAPE);
    }
  }

  /** Bloquea la fila de la franja (FOR UPDATE) para que no la reserven mientras se modifica o elimina. */
  private async bloquearFranjaLibreDelTutor(
    tx: Prisma.TransactionClient,
    tutorId: string,
    franjaId: string,
  ): Promise<void> {
    const filas = await tx.$queryRaw<{ estado: string }[]>`
      SELECT "estado"::text AS "estado"
      FROM "disponibilidad"
      WHERE "id" = ${franjaId}::uuid AND "tutor_id" = ${tutorId}::uuid AND "eliminada_en" IS NULL
      FOR UPDATE`;

    if (filas.length === 0) {
      throw noEncontrado("La franja no existe.");
    }
    if (filas[0].estado !== "LIBRE") {
      throw conflicto(MENSAJE_RESERVADA);
    }
  }
}

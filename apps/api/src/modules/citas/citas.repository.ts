import type { Prisma } from "@prisma/client";
import type { EstadoCita } from "@portal-tutorias/shared";
import type { Cliente } from "../../db/cliente.js";

export const INCLUDE_CITA = {
  estudiante: { select: { id: true, nombre: true } },
  franja: {
    include: {
      materia: { select: { nombre: true } },
      tutor: { select: { id: true, nombre: true } },
    },
  },
  propuestas: {
    where: { estado: "PENDIENTE" },
    include: { franjaOriginal: { select: { id: true, fechaInicio: true, fechaFin: true } } },
  },
} satisfies Prisma.CitaInclude;

export type CitaCompleta = Prisma.CitaGetPayload<{ include: typeof INCLUDE_CITA }>;

export interface CamposDeCita {
  estado?: EstadoCita;
  motivoRechazo?: string;
  franjaId?: string;
  fechaFinalizacion?: Date;
}

export interface RegistroDeHistorial {
  citaId: string;
  estadoAnterior: EstadoCita | null;
  estadoNuevo: EstadoCita;
  actorId: string;
  detalle: string;
}

/** Repositorio de citas, sus propuestas de reprogramacion y su bitacora de estados. */
export class CitasRepository {
  constructor(private readonly db: Cliente) {}

  async crear(estudianteId: string, franjaId: string): Promise<{ id: string }> {
    const cita = await this.db.cita.create({ data: { estudianteId, franjaId }, select: { id: true } });
    return cita;
  }

  cargar(id: string): Promise<CitaCompleta> {
    return this.db.cita.findUniqueOrThrow({ where: { id }, include: INCLUDE_CITA });
  }

  /** Bloquea la cita (FOR UPDATE) para serializar acciones simultaneas; null si no existe. Requiere transaccion. */
  async bloquearYCargar(id: string): Promise<CitaCompleta | null> {
    const filas = await this.db.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "cita" WHERE "id" = ${id}::uuid FOR UPDATE`;
    return filas.length === 0 ? null : this.cargar(id);
  }

  listarDeEstudiante(estudianteId: string): Promise<CitaCompleta[]> {
    return this.db.cita.findMany({
      where: { estudianteId },
      include: INCLUDE_CITA,
      orderBy: { creadoEn: "desc" },
    });
  }

  listarDeTutor(tutorId: string): Promise<CitaCompleta[]> {
    return this.db.cita.findMany({
      where: { franja: { tutorId } },
      include: INCLUDE_CITA,
      orderBy: { creadoEn: "desc" },
    });
  }

  async actualizar(id: string, cambios: CamposDeCita): Promise<void> {
    await this.db.cita.update({ where: { id }, data: cambios });
  }

  async crearPropuesta(datos: { citaId: string; franjaOriginalId: string; franjaNuevaId: string }): Promise<void> {
    await this.db.propuestaReprogramacion.create({ data: datos });
  }

  async cerrarPropuesta(id: string, estado: "ACEPTADA" | "RECHAZADA"): Promise<void> {
    await this.db.propuestaReprogramacion.update({ where: { id }, data: { estado, respondidoEn: new Date() } });
  }

  async registrarHistorial(registro: RegistroDeHistorial): Promise<void> {
    await this.db.historialEstadoCita.create({ data: registro });
  }
}

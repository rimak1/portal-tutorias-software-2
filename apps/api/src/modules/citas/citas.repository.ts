import type { Prisma } from "@prisma/client";
import type { Cliente } from "../../db/cliente.js";
import type { CamposDeCita, CitaConRelaciones, RegistroDeHistorial, RepositorioDeCitas } from "./citas.puertos.js";

const INCLUDE_CITA = {
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

/** Implementacion Prisma del repositorio de citas, sus propuestas de reprogramacion y su bitacora. */
export class CitasRepository implements RepositorioDeCitas {
  constructor(private readonly db: Cliente) {}

  crear(estudianteId: string, franjaId: string): Promise<{ id: string }> {
    return this.db.cita.create({ data: { estudianteId, franjaId }, select: { id: true } });
  }

  cargar(id: string): Promise<CitaConRelaciones> {
    return this.db.cita.findUniqueOrThrow({ where: { id }, include: INCLUDE_CITA });
  }

  async bloquearYCargar(id: string): Promise<CitaConRelaciones | null> {
    const filas = await this.db.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "cita" WHERE "id" = ${id}::uuid FOR UPDATE`;
    return filas.length === 0 ? null : this.cargar(id);
  }

  listarDeEstudiante(estudianteId: string): Promise<CitaConRelaciones[]> {
    return this.db.cita.findMany({ where: { estudianteId }, include: INCLUDE_CITA, orderBy: { creadoEn: "desc" } });
  }

  listarDeTutor(tutorId: string): Promise<CitaConRelaciones[]> {
    return this.db.cita.findMany({ where: { franja: { tutorId } }, include: INCLUDE_CITA, orderBy: { creadoEn: "desc" } });
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

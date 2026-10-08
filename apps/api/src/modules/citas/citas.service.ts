import { Prisma, type EstadoCita, type PrismaClient } from "@prisma/client";
import type { Cita, Rol } from "@portal-tutorias/shared";
import { conflicto, esViolacionDeUnicidad, noEncontrado, solicitudInvalida } from "../../lib/errors.js";

type Tx = Prisma.TransactionClient;

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

type CitaCompleta = Prisma.CitaGetPayload<{ include: typeof INCLUDE_CITA }>;

const MENSAJE_FRANJA_OCUPADA = "La franja ya fue reservada por otro estudiante. Elige otra.";
const MENSAJE_CITA_INEXISTENTE = "La cita no existe.";

function aCita(cita: CitaCompleta): Cita {
  const propuesta = cita.propuestas[0];
  return {
    id: cita.id,
    estado: cita.estado,
    motivoRechazo: cita.motivoRechazo,
    materia: cita.franja.materia.nombre,
    tutor: { id: cita.franja.tutor.id, nombre: cita.franja.tutor.nombre },
    estudiante: { id: cita.estudiante.id, nombre: cita.estudiante.nombre },
    franja: {
      id: cita.franja.id,
      fechaInicio: cita.franja.fechaInicio.toISOString(),
      fechaFin: cita.franja.fechaFin.toISOString(),
    },
    propuestaPendiente: propuesta
      ? {
          franjaOriginal: {
            id: propuesta.franjaOriginal.id,
            fechaInicio: propuesta.franjaOriginal.fechaInicio.toISOString(),
            fechaFin: propuesta.franjaOriginal.fechaFin.toISOString(),
          },
        }
      : null,
    creadoEn: cita.creadoEn.toISOString(),
    fechaFinalizacion: cita.fechaFinalizacion?.toISOString() ?? null,
  };
}

/** BR-04: cada cambio de estado queda en la bitacora con su actor, dentro de la misma transaccion. */
async function registrarCambio(
  tx: Tx,
  citaId: string,
  estadoAnterior: EstadoCita | null,
  estadoNuevo: EstadoCita,
  actorId: string,
  detalle: string,
): Promise<void> {
  await tx.historialEstadoCita.create({ data: { citaId, estadoAnterior, estadoNuevo, actorId, detalle } });
}

export class CitasService {
  constructor(private readonly prisma: PrismaClient) {}

  /** SWR-14: el estudiante y el tutor ven el estado actual de sus citas. */
  async listar(usuario: { id: string; rol: Rol }): Promise<Cita[]> {
    const citas = await this.prisma.cita.findMany({
      where: usuario.rol === "TUTOR" ? { franja: { tutorId: usuario.id } } : { estudianteId: usuario.id },
      include: INCLUDE_CITA,
      orderBy: { creadoEn: "desc" },
    });
    return citas.map(aCita);
  }

  /**
   * SWR-08 y SWR-09: crea la cita Pendiente y reserva la franja en una sola
   * transaccion. La fila de la franja se bloquea (FOR UPDATE) y el indice unico
   * parcial sobre cita(franja_id) respalda la regla aunque falle la aplicacion.
   */
  async reservar(estudianteId: string, franjaId: string): Promise<Cita> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const filas = await tx.$queryRaw<{ estado: string; fecha_inicio: Date; tutor_activo: boolean }[]>`
          SELECT d."estado"::text AS "estado", d."fecha_inicio" AS "fecha_inicio", u."activo" AS "tutor_activo"
          FROM "disponibilidad" d
          JOIN "usuario" u ON u."id" = d."tutor_id"
          WHERE d."id" = ${franjaId}::uuid AND d."eliminada_en" IS NULL
          FOR UPDATE OF d`;

        const franja = filas[0];
        if (!franja || !franja.tutor_activo) {
          throw noEncontrado("La franja no existe o ya no está disponible.");
        }
        if (franja.estado !== "LIBRE") {
          throw conflicto(MENSAJE_FRANJA_OCUPADA);
        }
        if (franja.fecha_inicio <= new Date()) {
          throw solicitudInvalida("La franja ya comenzó. Elige otra.");
        }

        const cita = await tx.cita.create({ data: { estudianteId, franjaId } });
        await tx.disponibilidad.update({ where: { id: franjaId }, data: { estado: "RESERVADA" } });
        await registrarCambio(tx, cita.id, null, "PENDIENTE", estudianteId, "Solicitud de tutoría creada");
        return this.cargar(tx, cita.id);
      });
    } catch (error) {
      if (esViolacionDeUnicidad(error)) throw conflicto(MENSAJE_FRANJA_OCUPADA);
      throw error;
    }
  }

  /** SWR-10: el tutor aprueba una solicitud pendiente. */
  async aprobar(tutorId: string, citaId: string): Promise<Cita> {
    return this.prisma.$transaction(async (tx) => {
      const cita = await this.bloquearYCargar(tx, citaId);
      this.exigirTutorDeLaCita(cita, tutorId);
      this.exigirPendienteSinPropuesta(cita, "aprobar");

      await tx.cita.update({ where: { id: citaId }, data: { estado: "APROBADA" } });
      await registrarCambio(tx, citaId, "PENDIENTE", "APROBADA", tutorId, "Solicitud aprobada");
      return this.cargar(tx, citaId);
    });
  }

  /** SWR-12 y SWR-19: el tutor rechaza con motivo obligatorio; la cita queda Rechazada y la franja se libera (RN-007). */
  async rechazar(tutorId: string, citaId: string, motivo: string): Promise<Cita> {
    const motivoLimpio = motivo.trim();
    if (!motivoLimpio) {
      throw solicitudInvalida("Indica el motivo del rechazo.");
    }

    return this.prisma.$transaction(async (tx) => {
      const cita = await this.bloquearYCargar(tx, citaId);
      this.exigirTutorDeLaCita(cita, tutorId);
      this.exigirPendienteSinPropuesta(cita, "rechazar");

      await tx.cita.update({ where: { id: citaId }, data: { estado: "RECHAZADA", motivoRechazo: motivoLimpio } });
      await tx.disponibilidad.update({ where: { id: cita.franja.id }, data: { estado: "LIBRE" } });
      await registrarCambio(tx, citaId, "PENDIENTE", "RECHAZADA", tutorId, motivoLimpio);
      return this.cargar(tx, citaId);
    });
  }

  /**
   * SWR-11: el tutor propone otra de sus franjas libres. La franja original se
   * libera y la nueva queda reservada mientras el estudiante decide.
   */
  async reprogramar(tutorId: string, citaId: string, nuevaFranjaId: string): Promise<Cita> {
    return this.prisma.$transaction(async (tx) => {
      const cita = await this.bloquearYCargar(tx, citaId);
      this.exigirTutorDeLaCita(cita, tutorId);
      this.exigirPendienteSinPropuesta(cita, "reprogramar");

      if (nuevaFranjaId === cita.franja.id) {
        throw solicitudInvalida("Elige una franja distinta a la actual.");
      }

      const filas = await tx.$queryRaw<{ estado: string; fecha_inicio: Date; tutor_id: string }[]>`
        SELECT "estado"::text AS "estado", "fecha_inicio", "tutor_id"
        FROM "disponibilidad"
        WHERE "id" = ${nuevaFranjaId}::uuid AND "eliminada_en" IS NULL
        FOR UPDATE`;
      const nueva = filas[0];
      if (!nueva || nueva.tutor_id !== tutorId) {
        throw noEncontrado("La franja propuesta no existe.");
      }
      if (nueva.estado !== "LIBRE") {
        throw conflicto("La franja propuesta ya no está libre.");
      }
      if (nueva.fecha_inicio <= new Date()) {
        throw solicitudInvalida("La franja propuesta ya comenzó.");
      }

      await tx.disponibilidad.update({ where: { id: cita.franja.id }, data: { estado: "LIBRE" } });
      await tx.disponibilidad.update({ where: { id: nuevaFranjaId }, data: { estado: "RESERVADA" } });
      await tx.cita.update({ where: { id: citaId }, data: { franjaId: nuevaFranjaId } });
      await tx.propuestaReprogramacion.create({
        data: { citaId, franjaOriginalId: cita.franja.id, franjaNuevaId: nuevaFranjaId },
      });
      await registrarCambio(tx, citaId, "PENDIENTE", "PENDIENTE", tutorId, "Reprogramación propuesta por el tutor");
      return this.cargar(tx, citaId);
    });
  }

  /** El estudiante acepta la propuesta: la cita queda Aprobada en la franja nueva. */
  async aceptarPropuesta(estudianteId: string, citaId: string): Promise<Cita> {
    return this.prisma.$transaction(async (tx) => {
      const cita = await this.bloquearYCargar(tx, citaId);
      this.exigirEstudianteDeLaCita(cita, estudianteId);
      const propuesta = this.exigirPropuestaPendiente(cita);

      await tx.propuestaReprogramacion.update({
        where: { id: propuesta.id },
        data: { estado: "ACEPTADA", respondidoEn: new Date() },
      });
      await tx.cita.update({ where: { id: citaId }, data: { estado: "APROBADA" } });
      await registrarCambio(tx, citaId, "PENDIENTE", "APROBADA", estudianteId, "Propuesta de reprogramación aceptada");
      return this.cargar(tx, citaId);
    });
  }

  /** El estudiante rechaza la propuesta: la cita queda Cancelada y la franja nueva se libera. */
  async rechazarPropuesta(estudianteId: string, citaId: string): Promise<Cita> {
    return this.prisma.$transaction(async (tx) => {
      const cita = await this.bloquearYCargar(tx, citaId);
      this.exigirEstudianteDeLaCita(cita, estudianteId);
      const propuesta = this.exigirPropuestaPendiente(cita);

      await tx.propuestaReprogramacion.update({
        where: { id: propuesta.id },
        data: { estado: "RECHAZADA", respondidoEn: new Date() },
      });
      await tx.cita.update({ where: { id: citaId }, data: { estado: "CANCELADA" } });
      await tx.disponibilidad.update({ where: { id: cita.franja.id }, data: { estado: "LIBRE" } });
      await registrarCambio(tx, citaId, "PENDIENTE", "CANCELADA", estudianteId, "Propuesta de reprogramación rechazada");
      return this.cargar(tx, citaId);
    });
  }

  /** SWR-21 y SWR-22: el estudiante cancela una cita Pendiente o Aprobada y la franja vuelve a quedar libre. */
  async cancelar(estudianteId: string, citaId: string): Promise<Cita> {
    return this.prisma.$transaction(async (tx) => {
      const cita = await this.bloquearYCargar(tx, citaId);
      this.exigirEstudianteDeLaCita(cita, estudianteId);

      if (cita.estado !== "PENDIENTE" && cita.estado !== "APROBADA") {
        throw conflicto("Solo se puede cancelar una cita pendiente o aprobada.");
      }

      const propuesta = cita.propuestas[0];
      if (propuesta) {
        await tx.propuestaReprogramacion.update({
          where: { id: propuesta.id },
          data: { estado: "RECHAZADA", respondidoEn: new Date() },
        });
      }

      await tx.cita.update({ where: { id: citaId }, data: { estado: "CANCELADA" } });
      await tx.disponibilidad.update({ where: { id: cita.franja.id }, data: { estado: "LIBRE" } });
      await registrarCambio(tx, citaId, cita.estado, "CANCELADA", estudianteId, "Cita cancelada por el estudiante");
      return this.cargar(tx, citaId);
    });
  }

  /** SWR-13: el tutor finaliza una cita Aprobada desde su hora de inicio. */
  async finalizar(tutorId: string, citaId: string): Promise<Cita> {
    return this.prisma.$transaction(async (tx) => {
      const cita = await this.bloquearYCargar(tx, citaId);
      this.exigirTutorDeLaCita(cita, tutorId);

      if (cita.estado !== "APROBADA") {
        throw conflicto("Solo se puede finalizar una cita aprobada.");
      }
      if (cita.franja.fechaInicio > new Date()) {
        throw conflicto("Solo puedes finalizar la tutoría desde su hora de inicio.");
      }

      await tx.cita.update({ where: { id: citaId }, data: { estado: "FINALIZADA", fechaFinalizacion: new Date() } });
      await registrarCambio(tx, citaId, "APROBADA", "FINALIZADA", tutorId, "Tutoría finalizada");
      return this.cargar(tx, citaId);
    });
  }

  private async cargar(tx: Tx, citaId: string): Promise<Cita> {
    const cita = await tx.cita.findUniqueOrThrow({ where: { id: citaId }, include: INCLUDE_CITA });
    return aCita(cita);
  }

  /** Bloquea la cita (FOR UPDATE) para serializar acciones simultaneas y revalidar su estado ya con el bloqueo. */
  private async bloquearYCargar(tx: Tx, citaId: string): Promise<CitaCompleta> {
    const filas = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "cita" WHERE "id" = ${citaId}::uuid FOR UPDATE`;
    if (filas.length === 0) {
      throw noEncontrado(MENSAJE_CITA_INEXISTENTE);
    }
    return tx.cita.findUniqueOrThrow({ where: { id: citaId }, include: INCLUDE_CITA });
  }

  // Los recursos ajenos se reportan como inexistentes para no revelar su existencia.
  private exigirTutorDeLaCita(cita: CitaCompleta, tutorId: string): void {
    if (cita.franja.tutor.id !== tutorId) {
      throw noEncontrado(MENSAJE_CITA_INEXISTENTE);
    }
  }

  private exigirEstudianteDeLaCita(cita: CitaCompleta, estudianteId: string): void {
    if (cita.estudiante.id !== estudianteId) {
      throw noEncontrado(MENSAJE_CITA_INEXISTENTE);
    }
  }

  private exigirPendienteSinPropuesta(cita: CitaCompleta, accion: string): void {
    if (cita.estado !== "PENDIENTE") {
      throw conflicto(`Solo se puede ${accion} una solicitud pendiente.`);
    }
    if (cita.propuestas.length > 0) {
      throw conflicto("Esta solicitud tiene una propuesta de reprogramación esperando respuesta del estudiante.");
    }
  }

  private exigirPropuestaPendiente(cita: CitaCompleta) {
    const propuesta = cita.propuestas[0];
    if (cita.estado !== "PENDIENTE" || !propuesta) {
      throw conflicto("Esta cita no tiene una propuesta de reprogramación pendiente.");
    }
    return propuesta;
  }
}

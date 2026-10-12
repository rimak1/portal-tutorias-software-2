import type { Cita } from "@portal-tutorias/shared";
import type { UnidadDeTrabajo } from "../../db/puertos.js";
import { conflicto, esViolacionDeUnicidad, noEncontrado, solicitudInvalida } from "../../lib/errors.js";
import type { Reloj } from "../../lib/reloj.js";
import type { PublicadorDeCambios } from "./citas.eventos.js";
import { aCita } from "./citas.mapper.js";
import { comoEstudiante, type EjecutorDeTransiciones } from "./ejecutor-de-transiciones.js";

const MENSAJE_FRANJA_OCUPADA = "La franja ya fue reservada por otro estudiante. Elige otra.";

/** Casos de uso del estudiante (F-04 y F-11): reservar, seguir sus citas, cancelar y responder propuestas. */
export class CitasDelEstudianteService {
  constructor(
    private readonly uow: UnidadDeTrabajo,
    private readonly cambios: PublicadorDeCambios,
    private readonly transiciones: EjecutorDeTransiciones,
    private readonly reloj: Reloj,
  ) {}

  /** SWR-14: el estudiante ve el estado actual de sus citas. */
  async listar(estudianteId: string): Promise<Cita[]> {
    return (await this.uow.repos.citas.listarDeEstudiante(estudianteId)).map(aCita);
  }

  /**
   * SWR-08 y SWR-09: crea la cita Pendiente y reserva la franja en una sola
   * transaccion. La fila de la franja se bloquea (FOR UPDATE) y el indice unico
   * parcial sobre cita(franja_id) respalda la regla aunque falle la aplicacion.
   */
  async reservar(estudianteId: string, franjaId: string): Promise<Cita> {
    try {
      return await this.uow.ejecutar(async (repos) => {
        const franja = await repos.franjas.bloquearParaReserva(franjaId);
        if (!franja || !franja.tutorActivo) {
          throw noEncontrado("La franja no existe o ya no está disponible.");
        }
        if (franja.estado !== "LIBRE") {
          throw conflicto(MENSAJE_FRANJA_OCUPADA);
        }
        if (franja.fechaInicio <= this.reloj.ahora()) {
          throw solicitudInvalida("La franja ya comenzó. Elige otra.");
        }

        const cita = await repos.citas.crear(estudianteId, franjaId);
        await repos.franjas.cambiarEstado(franjaId, "RESERVADA");
        await this.cambios.publicar(
          { citaId: cita.id, estadoAnterior: null, estadoNuevo: "PENDIENTE", actorId: estudianteId, detalle: "Solicitud de tutoría creada" },
          repos,
        );
        return aCita(await repos.citas.cargar(cita.id));
      });
    } catch (error) {
      if (esViolacionDeUnicidad(error)) throw conflicto(MENSAJE_FRANJA_OCUPADA);
      throw error;
    }
  }

  /** SWR-21 y SWR-22: cancelar una cita Pendiente o Aprobada y liberar la franja. */
  cancelar(estudianteId: string, citaId: string): Promise<Cita> {
    return this.transiciones.ejecutar({
      citaId,
      actor: comoEstudiante(estudianteId),
      decidir: (estado, contexto) => estado.cancelar(contexto),
      efectos: async ({ citas }, cita) => {
        // Una propuesta pendiente se descarta junto con la cita.
        if (cita.propuestas[0]) await citas.cerrarPropuesta(cita.propuestas[0].id, "RECHAZADA");
      },
    });
  }

  /** El estudiante acepta la propuesta: la cita queda Aprobada en la franja nueva. */
  aceptarPropuesta(estudianteId: string, citaId: string): Promise<Cita> {
    return this.transiciones.ejecutar({
      citaId,
      actor: comoEstudiante(estudianteId),
      decidir: (estado, contexto) => estado.aceptarPropuesta(contexto),
      efectos: ({ citas }, cita) => citas.cerrarPropuesta(cita.propuestas[0].id, "ACEPTADA"),
    });
  }

  /** El estudiante rechaza la propuesta: la cita queda Cancelada y la franja nueva se libera. */
  rechazarPropuesta(estudianteId: string, citaId: string): Promise<Cita> {
    return this.transiciones.ejecutar({
      citaId,
      actor: comoEstudiante(estudianteId),
      decidir: (estado, contexto) => estado.rechazarPropuesta(contexto),
      efectos: ({ citas }, cita) => citas.cerrarPropuesta(cita.propuestas[0].id, "RECHAZADA"),
    });
  }
}

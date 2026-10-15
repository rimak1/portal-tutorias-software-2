import type { Cita } from "@portal-tutorias/shared";
import type { UnidadDeTrabajo } from "../../db/puertos.js";
import { noEncontrado, solicitudInvalida } from "../../lib/errors.js";
import type { Reloj } from "../../lib/reloj.js";
import type { PublicadorDeCambios } from "./citas.eventos.js";
import { aCita } from "./citas.mapper.js";
import { FranjaYaReservada } from "./citas.puertos.js";
import { comoEstudiante, type EjecutorDeTransiciones } from "./ejecutor-de-transiciones.js";

/** Casos de uso del estudiante (F-04 y F-11): reservar, seguir sus citas, cancelar y responder propuestas. */
export class CitasDelEstudianteService {
  constructor(
    private readonly uow: UnidadDeTrabajo,
    private readonly cambios: PublicadorDeCambios,
    private readonly transiciones: EjecutorDeTransiciones,
    private readonly reloj: Reloj,
  ) {}

  /** SWR-14: citas del estudiante en su estado actual, de la más reciente a la más antigua. */
  async listar(estudianteId: string): Promise<Cita[]> {
    return (await this.uow.repos.citas.listarDeEstudiante(estudianteId)).map(aCita);
  }

  /**
   * SWR-08 y SWR-09: crea la cita Pendiente y reserva la franja en una sola
   * transacción. La fila de la franja queda bloqueada mientras tanto, y el
   * índice único sobre las citas activas impide la doble reserva aun si dos
   * solicitudes llegan a la vez.
   *
   * @throws ErrorDeNegocio 404 si la franja no existe, fue eliminada o su tutor está inactivo.
   * @throws FranjaYaReservada (409) si otra cita activa ocupa la franja.
   * @throws ErrorDeNegocio 400 si la franja ya comenzó.
   */
  reservar(estudianteId: string, franjaId: string): Promise<Cita> {
    return this.uow.ejecutar(async (repos) => {
      const franja = await repos.franjas.bloquearParaReserva(franjaId);
      if (!franja || !franja.tutorActivo) {
        throw noEncontrado("La franja no existe o ya no está disponible.");
      }
      if (franja.estado !== "LIBRE") {
        throw new FranjaYaReservada();
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
  }

  /**
   * SWR-21 y SWR-22: cancela una cita Pendiente o Aprobada y libera su franja.
   * Una propuesta de reprogramación pendiente se descarta junto con la cita.
   *
   * @throws ErrorDeNegocio 404 si la cita no existe o no es del estudiante.
   * @throws ErrorDeNegocio 409 si la cita no está Pendiente ni Aprobada.
   */
  cancelar(estudianteId: string, citaId: string): Promise<Cita> {
    return this.transiciones.ejecutar({
      citaId,
      actor: comoEstudiante(estudianteId),
      decidir: (estado, contexto) => estado.cancelar(contexto),
      efectos: async ({ citas }, cita) => {
        const propuesta = cita.propuestas[0];
        if (propuesta) await citas.cerrarPropuesta(propuesta.id, "RECHAZADA", this.reloj.ahora());
      },
    });
  }

  /**
   * Acepta la propuesta de reprogramación: la cita queda Aprobada en la franja nueva.
   *
   * @throws ErrorDeNegocio 404 si la cita no existe o no es del estudiante.
   * @throws ErrorDeNegocio 409 si la cita no tiene una propuesta pendiente.
   */
  aceptarPropuesta(estudianteId: string, citaId: string): Promise<Cita> {
    return this.transiciones.ejecutar({
      citaId,
      actor: comoEstudiante(estudianteId),
      decidir: (estado, contexto) => estado.aceptarPropuesta(contexto),
      efectos: ({ citas }, cita) => citas.cerrarPropuesta(cita.propuestas[0].id, "ACEPTADA", this.reloj.ahora()),
    });
  }

  /**
   * Rechaza la propuesta de reprogramación: la cita queda Cancelada y la franja nueva se libera.
   *
   * @throws ErrorDeNegocio 404 si la cita no existe o no es del estudiante.
   * @throws ErrorDeNegocio 409 si la cita no tiene una propuesta pendiente.
   */
  rechazarPropuesta(estudianteId: string, citaId: string): Promise<Cita> {
    return this.transiciones.ejecutar({
      citaId,
      actor: comoEstudiante(estudianteId),
      decidir: (estado, contexto) => estado.rechazarPropuesta(contexto),
      efectos: ({ citas }, cita) => citas.cerrarPropuesta(cita.propuestas[0].id, "RECHAZADA", this.reloj.ahora()),
    });
  }
}

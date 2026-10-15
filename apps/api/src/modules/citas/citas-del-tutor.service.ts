import type { Cita } from "@portal-tutorias/shared";
import type { UnidadDeTrabajo } from "../../db/puertos.js";
import { conflicto, noEncontrado, solicitudInvalida } from "../../lib/errors.js";
import type { Reloj } from "../../lib/reloj.js";
import { aCita } from "./citas.mapper.js";
import { comoTutor, type EjecutorDeTransiciones } from "./ejecutor-de-transiciones.js";

/** Casos de uso del tutor (F-05 y F-06): atender solicitudes, reprogramar y finalizar citas. */
export class CitasDelTutorService {
  constructor(
    private readonly uow: UnidadDeTrabajo,
    private readonly transiciones: EjecutorDeTransiciones,
    private readonly reloj: Reloj,
  ) {}

  /** SWR-14: citas sobre las franjas del tutor en su estado actual, de la más reciente a la más antigua. */
  async listar(tutorId: string): Promise<Cita[]> {
    return (await this.uow.repos.citas.listarDeTutor(tutorId)).map(aCita);
  }

  /**
   * SWR-10: aprueba una solicitud pendiente.
   *
   * @throws ErrorDeNegocio 404 si la cita no existe o no es sobre una franja del tutor.
   * @throws ErrorDeNegocio 409 si la cita no está Pendiente o espera respuesta a una propuesta.
   */
  aprobar(tutorId: string, citaId: string): Promise<Cita> {
    return this.transiciones.ejecutar({
      citaId,
      actor: comoTutor(tutorId),
      decidir: (estado, contexto) => estado.aprobar(contexto),
    });
  }

  /**
   * SWR-12 y SWR-19: rechaza una solicitud con motivo obligatorio; la cita queda
   * Rechazada y la franja se libera (RN-007).
   *
   * @throws ErrorDeNegocio 400 si el motivo está vacío.
   * @throws ErrorDeNegocio 404 si la cita no existe o no es sobre una franja del tutor.
   * @throws ErrorDeNegocio 409 si la cita no está Pendiente o espera respuesta a una propuesta.
   */
  async rechazar(tutorId: string, citaId: string, motivo: string): Promise<Cita> {
    const motivoLimpio = motivo.trim();
    if (!motivoLimpio) {
      throw solicitudInvalida("Indica el motivo del rechazo.");
    }
    return this.transiciones.ejecutar({
      citaId,
      actor: comoTutor(tutorId),
      decidir: (estado, contexto) => ({ ...estado.rechazar(contexto), detalle: motivoLimpio }),
      datos: { motivoRechazo: motivoLimpio },
    });
  }

  /**
   * SWR-11: propone otra franja libre del tutor. La franja original se libera y
   * la nueva queda reservada mientras el estudiante responde.
   *
   * @throws ErrorDeNegocio 400 si la franja propuesta es la actual o ya comenzó.
   * @throws ErrorDeNegocio 404 si la cita o la franja propuesta no existen o no son del tutor.
   * @throws ErrorDeNegocio 409 si la cita no está Pendiente, ya tiene una propuesta o la franja no está libre.
   */
  reprogramar(tutorId: string, citaId: string, nuevaFranjaId: string): Promise<Cita> {
    return this.transiciones.ejecutar({
      citaId,
      actor: comoTutor(tutorId),
      decidir: (estado, contexto) => estado.reprogramar(contexto),
      efectos: async ({ franjas, citas }, cita) => {
        if (nuevaFranjaId === cita.franja.id) {
          throw solicitudInvalida("Elige una franja distinta a la actual.");
        }
        const nueva = await franjas.bloquearParaReprogramar(nuevaFranjaId);
        if (!nueva || nueva.tutorId !== tutorId) {
          throw noEncontrado("La franja propuesta no existe.");
        }
        if (nueva.estado !== "LIBRE") {
          throw conflicto("La franja propuesta ya no está libre.");
        }
        if (nueva.fechaInicio <= this.reloj.ahora()) {
          throw solicitudInvalida("La franja propuesta ya comenzó.");
        }

        await franjas.cambiarEstado(nuevaFranjaId, "RESERVADA");
        await citas.actualizar(cita.id, { franjaId: nuevaFranjaId });
        await citas.crearPropuesta({ citaId: cita.id, franjaOriginalId: cita.franja.id, franjaNuevaId: nuevaFranjaId });
      },
    });
  }

  /**
   * SWR-13: finaliza una cita Aprobada a partir de su hora de inicio.
   *
   * @throws ErrorDeNegocio 404 si la cita no existe o no es sobre una franja del tutor.
   * @throws ErrorDeNegocio 409 si la cita no está Aprobada o aún no ha comenzado.
   */
  finalizar(tutorId: string, citaId: string): Promise<Cita> {
    return this.transiciones.ejecutar({
      citaId,
      actor: comoTutor(tutorId),
      decidir: (estado, contexto) => estado.finalizar(contexto),
      datos: { fechaFinalizacion: this.reloj.ahora() },
    });
  }
}

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

  /** SWR-14: el tutor ve el estado actual de las citas sobre sus franjas. */
  async listar(tutorId: string): Promise<Cita[]> {
    return (await this.uow.repos.citas.listarDeTutor(tutorId)).map(aCita);
  }

  /** SWR-10: el tutor aprueba una solicitud pendiente. */
  aprobar(tutorId: string, citaId: string): Promise<Cita> {
    return this.transiciones.ejecutar({
      citaId,
      actor: comoTutor(tutorId),
      decidir: (estado, contexto) => estado.aprobar(contexto),
    });
  }

  /** SWR-12 y SWR-19: rechazo con motivo obligatorio; la cita queda Rechazada y la franja se libera (RN-007). */
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
   * SWR-11: el tutor propone otra de sus franjas libres. La franja original se
   * libera (la libera la transicion) y la nueva queda reservada mientras el
   * estudiante decide.
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

  /** SWR-13: el tutor finaliza una cita Aprobada desde su hora de inicio. */
  finalizar(tutorId: string, citaId: string): Promise<Cita> {
    return this.transiciones.ejecutar({
      citaId,
      actor: comoTutor(tutorId),
      decidir: (estado, contexto) => estado.finalizar(contexto),
      datos: { fechaFinalizacion: this.reloj.ahora() },
    });
  }
}

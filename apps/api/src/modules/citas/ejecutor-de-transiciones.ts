import type { Cita } from "@portal-tutorias/shared";
import type { Repositorios, UnidadDeTrabajo } from "../../db/puertos.js";
import { noEncontrado } from "../../lib/errors.js";
import type { Reloj } from "../../lib/reloj.js";
import { estadoDe, type ContextoCita, type EstadoDeCita, type Transicion } from "./cita.estados.js";
import type { PublicadorDeCambios } from "./citas.eventos.js";
import { aCita } from "./citas.mapper.js";
import type { CamposDeCita, CitaConRelaciones } from "./citas.puertos.js";

export const MENSAJE_CITA_INEXISTENTE = "La cita no existe.";

export type Participante = { rol: "ESTUDIANTE" | "TUTOR"; id: string };

export const comoTutor = (id: string): Participante => ({ rol: "TUTOR", id });
export const comoEstudiante = (id: string): Participante => ({ rol: "ESTUDIANTE", id });

/** Una acción de un participante sobre una cita. */
export interface Accion {
  citaId: string;
  actor: Participante;
  /** Pregunta al estado actual de la cita si admite la acción; lanza ErrorDeNegocio si no. */
  decidir: (estado: EstadoDeCita, contexto: ContextoCita) => Transicion;
  /** Campos de la cita que cambian además del estado. */
  datos?: Omit<CamposDeCita, "estado" | "franjaId">;
  /** Escrituras propias de la acción, dentro de la misma transacción. */
  efectos?: (repos: Repositorios, cita: CitaConRelaciones) => Promise<void>;
}

/**
 * Ejecuta las acciones sobre una cita con un mismo procedimiento, en una sola
 * transacción: bloquea la cita, comprueba que el actor participe en ella, deja
 * que su estado decida la transición, la aplica (liberando la franja si
 * corresponde, RN-007) y la anuncia para el historial. Los servicios de
 * estudiante y de tutor solo describen cada acción.
 */
export class EjecutorDeTransiciones {
  constructor(
    private readonly uow: UnidadDeTrabajo,
    private readonly cambios: PublicadorDeCambios,
    private readonly reloj: Reloj,
  ) {}

  /**
   * @returns La cita como queda después de la acción.
   * @throws ErrorDeNegocio 404 si la cita no existe o el actor no participa en ella.
   * @throws ErrorDeNegocio 409 si el estado actual de la cita no admite la acción.
   */
  ejecutar(accion: Accion): Promise<Cita> {
    return this.uow.ejecutar(async (repos) => {
      // El bloqueo serializa acciones simultáneas sobre la misma cita: el estado se lee ya bloqueado.
      const cita = await repos.citas.bloquearYCargar(accion.citaId);

      // Una cita ajena se reporta como inexistente, para no revelar que existe.
      if (!cita || !this.participa(cita, accion.actor)) {
        throw noEncontrado(MENSAJE_CITA_INEXISTENTE);
      }

      const transicion = accion.decidir(estadoDe(cita.estado), {
        tienePropuestaPendiente: cita.propuestas.length > 0,
        inicioFranja: cita.franja.fechaInicio,
        ahora: this.reloj.ahora(),
      });

      await repos.citas.actualizar(cita.id, { estado: transicion.hacia, ...accion.datos });
      if (transicion.liberaFranja) {
        await repos.franjas.cambiarEstado(cita.franja.id, "LIBRE");
      }
      await accion.efectos?.(repos, cita);

      await this.cambios.publicar(
        { citaId: cita.id, estadoAnterior: cita.estado, estadoNuevo: transicion.hacia, actorId: accion.actor.id, detalle: transicion.detalle },
        repos,
      );

      return aCita(await repos.citas.cargar(cita.id));
    });
  }

  private participa(cita: CitaConRelaciones, actor: Participante): boolean {
    return actor.rol === "TUTOR" ? cita.franja.tutor.id === actor.id : cita.estudiante.id === actor.id;
  }
}

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

export interface Accion {
  citaId: string;
  actor: Participante;
  /** Lo decide el estado actual de la cita (patron State); lanza si la accion no es valida. */
  decidir: (estado: EstadoDeCita, contexto: ContextoCita) => Transicion;
  /** Campos de la cita que cambian ademas del estado. */
  datos?: Omit<CamposDeCita, "estado" | "franjaId">;
  /** Efectos propios de la accion, dentro de la misma transaccion. */
  efectos?: (repos: Repositorios, cita: CitaConRelaciones) => Promise<void>;
}

/**
 * Template Method: el esqueleto comun de toda accion sobre una cita. Los pasos
 * que varian (que estado la admite y los efectos propios) los aporta cada
 * accion; el orden y la atomicidad no se pueden olvidar ni alterar. Es la unica
 * pieza que sabe bloquear, autorizar, aplicar y anunciar: los servicios de
 * estudiante y de tutor solo declaran sus acciones.
 */
export class EjecutorDeTransiciones {
  constructor(
    private readonly uow: UnidadDeTrabajo,
    private readonly cambios: PublicadorDeCambios,
    private readonly reloj: Reloj,
  ) {}

  ejecutar(accion: Accion): Promise<Cita> {
    return this.uow.ejecutar(async (repos) => {
      // 1. Bloquear la cita: acciones simultaneas se serializan y se revalida el estado ya con el bloqueo.
      const cita = await repos.citas.bloquearYCargar(accion.citaId);

      // 2. Autorizar: solo quien participa en la cita puede actuar; lo ajeno se reporta como inexistente.
      if (!cita || !this.participa(cita, accion.actor)) {
        throw noEncontrado(MENSAJE_CITA_INEXISTENTE);
      }

      // 3. El estado actual decide si la accion es valida y a donde lleva.
      const transicion = accion.decidir(estadoDe(cita.estado), {
        tienePropuestaPendiente: cita.propuestas.length > 0,
        inicioFranja: cita.franja.fechaInicio,
        ahora: this.reloj.ahora(),
      });

      // 4. Aplicar el cambio y, si corresponde, liberar la franja (RN-007).
      await repos.citas.actualizar(cita.id, { estado: transicion.hacia, ...accion.datos });
      if (transicion.liberaFranja) {
        await repos.franjas.cambiarEstado(cita.franja.id, "LIBRE");
      }
      await accion.efectos?.(repos, cita);

      // 5. Anunciar el cambio (bitacora y, mas adelante, notificaciones) dentro de la misma transaccion.
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

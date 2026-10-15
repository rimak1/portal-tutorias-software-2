import type { EstadoCita } from "@portal-tutorias/shared";
import type { Repositorios } from "../../db/puertos.js";

export interface CambioDeEstadoDeCita {
  citaId: string;
  estadoAnterior: EstadoCita | null;
  estadoNuevo: EstadoCita;
  actorId: string;
  detalle: string;
}

/**
 * Reacción a un cambio de estado. Recibe los repositorios de la misma
 * transacción que el cambio: si el suscriptor falla, el cambio tampoco se confirma.
 */
export type SuscriptorDeCambios = (cambio: CambioDeEstadoDeCita, repos: Repositorios) => Promise<void>;

/** Anuncia los cambios de estado de las citas a quien se haya suscrito. */
export interface PublicadorDeCambios {
  publicar(cambio: CambioDeEstadoDeCita, repos: Repositorios): Promise<void>;
}

/**
 * Lista de suscriptores a los cambios de estado de las citas. Hoy solo escucha
 * el historial; las notificaciones dentro de la plataforma (RF-017, F-07) se
 * agregarán como otro suscriptor, sin modificar los casos de uso.
 */
export class CambiosDeCita implements PublicadorDeCambios {
  private readonly suscriptores: SuscriptorDeCambios[] = [];

  /** Agrega un suscriptor y devuelve la función que lo retira. */
  suscribir(suscriptor: SuscriptorDeCambios): () => void {
    this.suscriptores.push(suscriptor);
    return () => {
      const indice = this.suscriptores.indexOf(suscriptor);
      if (indice >= 0) this.suscriptores.splice(indice, 1);
    };
  }

  /** Notifica a los suscriptores en orden; si uno lanza, el error se propaga y los siguientes no se ejecutan. */
  async publicar(cambio: CambioDeEstadoDeCita, repos: Repositorios): Promise<void> {
    for (const suscriptor of [...this.suscriptores]) {
      await suscriptor(cambio, repos);
    }
  }
}

/** BR-04: toda transición queda en el historial de la cita, con su actor. */
export const registrarEnHistorial: SuscriptorDeCambios = (cambio, repos) => repos.citas.registrarHistorial(cambio);

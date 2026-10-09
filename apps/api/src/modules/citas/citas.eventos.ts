import type { EstadoCita } from "@portal-tutorias/shared";
import type { Repositorios } from "../../db/unidad-de-trabajo.js";

export interface CambioDeEstadoDeCita {
  citaId: string;
  estadoAnterior: EstadoCita | null;
  estadoNuevo: EstadoCita;
  actorId: string;
  detalle: string;
}

/** Recibe los repositorios de la MISMA transaccion: si falla, el cambio de estado tampoco se confirma. */
export type SuscriptorDeCambios = (cambio: CambioDeEstadoDeCita, repos: Repositorios) => Promise<void>;

/**
 * Patron Observer: el servicio de citas anuncia cada cambio de estado sin saber
 * quien lo atiende. Hoy lo escucha la bitacora; las notificaciones dentro de la
 * plataforma (RF-017, funcionalidad F-07) se sumaran como un suscriptor mas.
 */
export class CambiosDeCita {
  private readonly suscriptores: SuscriptorDeCambios[] = [];

  /** Devuelve una funcion para cancelar la suscripcion. */
  suscribir(suscriptor: SuscriptorDeCambios): () => void {
    this.suscriptores.push(suscriptor);
    return () => {
      const indice = this.suscriptores.indexOf(suscriptor);
      if (indice >= 0) this.suscriptores.splice(indice, 1);
    };
  }

  async publicar(cambio: CambioDeEstadoDeCita, repos: Repositorios): Promise<void> {
    for (const suscriptor of [...this.suscriptores]) {
      await suscriptor(cambio, repos);
    }
  }
}

/** BR-04: toda transicion queda en la bitacora con su actor. */
export const registrarEnHistorial: SuscriptorDeCambios = (cambio, repos) => repos.citas.registrarHistorial(cambio);

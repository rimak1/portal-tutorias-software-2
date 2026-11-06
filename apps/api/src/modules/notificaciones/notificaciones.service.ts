import type { ListaDeNotificaciones } from "@portal-tutorias/shared";
import { noEncontrado } from "../../lib/errors.js";
import type { Reloj } from "../../lib/reloj.js";
import { aNotificacion } from "./notificaciones.mapper.js";
import type { NotificacionesDelUsuario } from "./notificaciones.puertos.js";

/** Cuántos avisos recientes trae la lista; el contador de no leídas cuenta todos. */
export const AVISOS_POR_LISTA = 30;

export const MENSAJE_AVISO_INEXISTENTE = "La notificación no existe.";

/** F-07 (SWR-15): el usuario consulta sus avisos y los marca como leídos. */
export class NotificacionesService {
  constructor(
    private readonly avisos: NotificacionesDelUsuario,
    private readonly reloj: Reloj,
  ) {}

  async listar(usuarioId: string): Promise<ListaDeNotificaciones> {
    const [recientes, noLeidas] = await Promise.all([this.avisos.listar(usuarioId, AVISOS_POR_LISTA), this.avisos.contarNoLeidas(usuarioId)]);
    return { notificaciones: recientes.map(aNotificacion), noLeidas };
  }

  /** @throws ErrorDeNegocio 404 si el aviso no existe o es de otro usuario. */
  async marcarLeida(usuarioId: string, id: string): Promise<void> {
    if (!(await this.avisos.marcarLeida(id, usuarioId, this.reloj.ahora()))) {
      throw noEncontrado(MENSAJE_AVISO_INEXISTENTE);
    }
  }

  marcarTodasLeidas(usuarioId: string): Promise<void> {
    return this.avisos.marcarTodasLeidas(usuarioId, this.reloj.ahora());
  }
}

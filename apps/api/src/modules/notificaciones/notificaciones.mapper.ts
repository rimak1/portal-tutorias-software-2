import type { Notificacion } from "@portal-tutorias/shared";
import type { NotificacionGuardada } from "./notificaciones.puertos.js";

/** Convierte un aviso guardado en el DTO `Notificacion` que responde la API. */
export function aNotificacion(aviso: NotificacionGuardada): Notificacion {
  return {
    id: aviso.id,
    titulo: aviso.titulo,
    texto: aviso.texto,
    citaId: aviso.citaId,
    leida: aviso.leidaEn !== null,
    creadoEn: aviso.creadoEn.toISOString(),
  };
}

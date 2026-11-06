import type { ListaDeNotificaciones } from "@portal-tutorias/shared";
import { apiClient } from "../api-client";

/** Avisos del usuario sobre sus citas (F-07). */
export const notificacionesApi = {
  listar: () => apiClient.get<ListaDeNotificaciones>("/notificaciones"),
  marcarLeida: (id: string) => apiClient.post<{ ok: boolean }>(`/notificaciones/${id}/leer`),
  marcarTodasLeidas: () => apiClient.post<{ ok: boolean }>("/notificaciones/leer-todas"),
};

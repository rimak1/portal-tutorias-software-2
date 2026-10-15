import type { CrearFranjaInput, Disponibilidad, FranjaPropia } from "@portal-tutorias/shared";
import { apiClient } from "../api-client";

/** Franjas disponibles para reservar y agenda propia del tutor. */
export const disponibilidadApi = {
  listar: (filtros: { materiaId?: string } = {}) => {
    const consulta = filtros.materiaId ? `?materiaId=${encodeURIComponent(filtros.materiaId)}` : "";
    return apiClient.get<{ disponibilidades: Disponibilidad[] }>(`/disponibilidad${consulta}`).then((r) => r.disponibilidades);
  },
  listarMiAgenda: () => apiClient.get<{ franjas: FranjaPropia[] }>("/disponibilidad/mias").then((r) => r.franjas),
  crear: (datos: CrearFranjaInput) => apiClient.post<{ franja: FranjaPropia }>("/disponibilidad", datos).then((r) => r.franja),
  actualizar: (id: string, datos: CrearFranjaInput) =>
    apiClient.patch<{ franja: FranjaPropia }>(`/disponibilidad/${id}`, datos).then((r) => r.franja),
  eliminar: (id: string) => apiClient.delete(`/disponibilidad/${id}`),
};

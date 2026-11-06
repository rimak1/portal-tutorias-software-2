import type { DetalleDeHistorico, Historico } from "@portal-tutorias/shared";
import { apiClient } from "../api-client";

/** Histórico y reportes de tutorías (F-09); `consulta` es la cadena de filtros que arma `historico-filtros.ts`. */
export const historicoApi = {
  consultar: (consulta: string) => apiClient.get<Historico>(`/historico?${consulta}`),
  detalle: (citaId: string) => apiClient.get<DetalleDeHistorico>(`/historico/${citaId}`),
  /** Dirección de la descarga en CSV; el navegador envía la cookie de sesión al abrirla. */
  urlDeExportacion: (consulta: string) => `/api/historico/exportar?${consulta}`,
};

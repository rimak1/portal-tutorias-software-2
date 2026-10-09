import type { Cita } from "@portal-tutorias/shared";
import { apiClient } from "../api-client";

const accionSobre = (id: string, accion: string, payload?: object) =>
  apiClient.post<{ cita: Cita }>(`/citas/${id}/${accion}`, payload).then((r) => r.cita);

/** Fachada de las citas: una funcion por caso de uso, sin rutas sueltas en los componentes. */
export const citasApi = {
  listar: () => apiClient.get<{ citas: Cita[] }>("/citas").then((r) => r.citas),
  reservar: (disponibilidadId: string) => apiClient.post<{ cita: Cita }>("/citas", { disponibilidadId }).then((r) => r.cita),
  aprobar: (id: string) => accionSobre(id, "aprobar"),
  rechazar: (id: string, motivo: string) => accionSobre(id, "rechazar", { motivo }),
  reprogramar: (id: string, disponibilidadId: string) => accionSobre(id, "reprogramar", { disponibilidadId }),
  finalizar: (id: string) => accionSobre(id, "finalizar"),
  cancelar: (id: string) => accionSobre(id, "cancelar"),
  aceptarPropuesta: (id: string) => accionSobre(id, "propuesta/aceptar"),
  rechazarPropuesta: (id: string) => accionSobre(id, "propuesta/rechazar"),
};

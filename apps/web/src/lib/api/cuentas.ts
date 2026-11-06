import type { ActualizarCuentaInput, CrearCuentaInput, Cuenta } from "@portal-tutorias/shared";
import { apiClient } from "../api-client";

/** Administración de cuentas de usuario (F-08). */
export const cuentasApi = {
  listar: () => apiClient.get<{ cuentas: Cuenta[] }>("/usuarios").then((r) => r.cuentas),
  crear: (datos: CrearCuentaInput) => apiClient.post<{ cuenta: Cuenta }>("/usuarios", datos).then((r) => r.cuenta),
  actualizar: (id: string, cambios: ActualizarCuentaInput) =>
    apiClient.patch<{ cuenta: Cuenta }>(`/usuarios/${id}`, cambios).then((r) => r.cuenta),
};

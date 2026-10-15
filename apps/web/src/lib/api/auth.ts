import type { UsuarioSesion } from "@portal-tutorias/shared";
import { apiClient } from "../api-client";

/** Inicio y cierre de sesión y restablecimiento de contraseña. */
export const authApi = {
  sesionActual: () => apiClient.get<{ usuario: UsuarioSesion }>("/auth/sesion").then((r) => r.usuario),
  iniciarSesion: (correo: string, password: string) =>
    apiClient.post<{ usuario: UsuarioSesion }>("/auth/login", { correo, password }).then((r) => r.usuario),
  cerrarSesion: () => apiClient.post("/auth/logout").then(() => undefined),
  solicitarRecuperacion: (correo: string) => apiClient.post("/auth/recuperar", { correo }).then(() => undefined),
  restablecerPassword: (token: string, password: string) =>
    apiClient.post("/auth/restablecer", { token, password }).then(() => undefined),
};

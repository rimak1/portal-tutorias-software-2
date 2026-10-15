import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { UsuarioSesion } from "@portal-tutorias/shared";
import { ApiError } from "./api-client";
import { authApi } from "./api/auth";

interface AuthContextValue {
  /** null mientras no haya sesión. */
  usuario: UsuarioSesion | null;
  /** true hasta saber si había una sesión abierta al cargar la aplicación. */
  cargando: boolean;
  /** Lanza ApiError si las credenciales no son válidas. */
  login: (correo: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/** Mantiene el usuario de la sesión actual y lo expone a la aplicación mediante `useAuth`. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioSesion | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    authApi
      .sesionActual()
      .then(setUsuario)
      .catch(() => setUsuario(null))
      .finally(() => setCargando(false));
  }, []);

  const login = useCallback(async (correo: string, password: string) => {
    setUsuario(await authApi.iniciarSesion(correo, password));
  }, []);

  // La sesión local se cierra aunque el servidor responda con error (p. ej. la sesión ya había vencido).
  const logout = useCallback(async () => {
    try {
      await authApi.cerrarSesion();
    } catch (error) {
      if (!(error instanceof ApiError)) {
        throw error;
      }
    } finally {
      setUsuario(null);
    }
  }, []);

  const value = useMemo(() => ({ usuario, cargando, login, logout }), [usuario, cargando, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Sesión actual. Solo puede usarse dentro de un AuthProvider. */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe usarse dentro de un AuthProvider");
  }
  return context;
}

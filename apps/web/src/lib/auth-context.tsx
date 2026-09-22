import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { UsuarioSesion } from "@portal-tutorias/shared";
import { apiClient, ApiError } from "./api-client";

interface AuthContextValue {
  usuario: UsuarioSesion | null;
  cargando: boolean;
  login: (correo: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioSesion | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargarSesion = useCallback(async () => {
    try {
      const data = await apiClient.get<{ usuario: UsuarioSesion }>("/auth/sesion");
      setUsuario(data.usuario);
    } catch {
      setUsuario(null);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarSesion();
  }, [cargarSesion]);

  const login = useCallback(async (correo: string, password: string) => {
    const data = await apiClient.post<{ usuario: UsuarioSesion }>("/auth/login", { correo, password });
    setUsuario(data.usuario);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiClient.post("/auth/logout");
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

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe usarse dentro de un AuthProvider");
  }
  return context;
}

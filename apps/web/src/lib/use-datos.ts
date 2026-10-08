import { useCallback, useEffect, useState } from "react";
import { apiClient, ApiError } from "./api-client";

export function mensajeDeError(err: unknown, porDefecto: string): string {
  return err instanceof ApiError ? err.message : porDefecto;
}

/** Carga un recurso de la API al montar (y cuando cambia la ruta) y permite volver a pedirlo. */
export function useDatos<T>(path: string) {
  const [datos, setDatos] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;
    apiClient
      .get<T>(path)
      .then((respuesta) => {
        if (!activo) return;
        setDatos(respuesta);
        setError(null);
      })
      .catch((err) => {
        if (activo) setError(mensajeDeError(err, "No fue posible cargar la información."));
      });
    return () => {
      activo = false;
    };
  }, [path]);

  const recargar = useCallback(async () => {
    try {
      setDatos(await apiClient.get<T>(path));
      setError(null);
    } catch (err) {
      setError(mensajeDeError(err, "No fue posible cargar la información."));
    }
  }, [path]);

  return { datos, error, recargar };
}

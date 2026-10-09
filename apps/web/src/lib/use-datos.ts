import { useCallback, useEffect, useState } from "react";
import { ApiError } from "./api-client";

export function mensajeDeError(err: unknown, porDefecto: string): string {
  return err instanceof ApiError ? err.message : porDefecto;
}

/**
 * Custom hook: carga un recurso al montar (y cuando cambia `cargar`) y permite
 * volver a pedirlo. `cargar` debe ser estable (una funcion de una fachada o un
 * `useCallback`) para que no se vuelva a pedir en cada render.
 */
export function useDatos<T>(cargar: () => Promise<T>) {
  const [datos, setDatos] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;
    cargar()
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
  }, [cargar]);

  const recargar = useCallback(async () => {
    try {
      setDatos(await cargar());
      setError(null);
    } catch (err) {
      setError(mensajeDeError(err, "No fue posible cargar la información."));
    }
  }, [cargar]);

  return { datos, error, recargar };
}

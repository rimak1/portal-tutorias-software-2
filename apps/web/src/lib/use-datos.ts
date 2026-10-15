import { useCallback, useEffect, useState } from "react";
import { mensajeDeError } from "./api-client";

const ERROR_DE_CARGA = "No fue posible cargar la información.";

/**
 * Carga un recurso al montar el componente (y cada vez que cambia `cargar`) y
 * permite volver a pedirlo con `recargar`. `cargar` debe ser estable (una
 * función de `lib/api` o envuelta en `useCallback`); si no, se pediría en cada render.
 */
export function useDatos<T>(cargar: () => Promise<T>) {
  const [datos, setDatos] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pedir = useCallback(
    async (sigueVigente: () => boolean = () => true) => {
      try {
        const respuesta = await cargar();
        if (!sigueVigente()) return;
        setDatos(respuesta);
        setError(null);
      } catch (err) {
        if (sigueVigente()) setError(mensajeDeError(err, ERROR_DE_CARGA));
      }
    },
    [cargar],
  );

  useEffect(() => {
    let vigente = true;
    void pedir(() => vigente);
    return () => {
      vigente = false;
    };
  }, [pedir]);

  const recargar = useCallback(() => pedir(), [pedir]);

  return { datos, error, recargar };
}

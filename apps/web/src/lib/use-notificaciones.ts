import { useCallback, useEffect } from "react";
import { notificacionesApi } from "./api/notificaciones";
import { useDatos } from "./use-datos";

/** Cada cuánto se consultan los avisos nuevos mientras la pestaña está visible (sin comunicación en tiempo real, ADR-13). */
export const INTERVALO_DE_CONSULTA_MS = 30_000;

/**
 * Avisos del usuario (F-07). Se consultan al montar, cada `intervaloMs` mientras
 * la pestaña está visible y al volver a ella, para que un aviso nuevo aparezca
 * sin recargar la página.
 */
export function useNotificaciones(intervaloMs = INTERVALO_DE_CONSULTA_MS) {
  const { datos, error, recargar } = useDatos(notificacionesApi.listar);

  useEffect(() => {
    const consultar = () => {
      if (document.visibilityState === "visible") void recargar();
    };
    const temporizador = window.setInterval(consultar, intervaloMs);
    document.addEventListener("visibilitychange", consultar);
    return () => {
      window.clearInterval(temporizador);
      document.removeEventListener("visibilitychange", consultar);
    };
  }, [recargar, intervaloMs]);

  const marcarLeida = useCallback(
    async (id: string) => {
      await notificacionesApi.marcarLeida(id);
      await recargar();
    },
    [recargar],
  );

  const marcarTodasLeidas = useCallback(async () => {
    await notificacionesApi.marcarTodasLeidas();
    await recargar();
  }, [recargar]);

  return { notificaciones: datos?.notificaciones ?? [], noLeidas: datos?.noLeidas ?? 0, cargado: datos !== null, error, recargar, marcarLeida, marcarTodasLeidas };
}

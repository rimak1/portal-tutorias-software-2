import { useCallback, useState } from "react";
import { mensajeDeError } from "./api-client";

/**
 * Ejecuta acciones sobre las citas de una lista: indica qué cita se está
 * procesando, guarda el mensaje de error si la acción falla y, en ambos casos,
 * recarga la lista. `ejecutar` devuelve true si la acción tuvo éxito.
 */
export function useAccionesDeCita(recargar: () => Promise<void>) {
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [procesando, setProcesando] = useState<string | null>(null);

  const ejecutar = useCallback(
    async (citaId: string, accion: () => Promise<unknown>): Promise<boolean> => {
      setProcesando(citaId);
      setMensaje(null);
      try {
        await accion();
        return true;
      } catch (err) {
        setMensaje(mensajeDeError(err, "No fue posible completar la acción."));
        return false;
      } finally {
        setProcesando(null);
        await recargar();
      }
    },
    [recargar],
  );

  return { mensaje, procesando, ejecutar };
}

import { useCallback, useState } from "react";
import { mensajeDeError } from "./use-datos";

/**
 * Custom hook compartido por las listas de citas del estudiante y del tutor:
 * ejecuta una accion, informa si esta en curso, muestra el error si falla y
 * refresca la lista al terminar. Devuelve true si la accion tuvo exito.
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

  return { mensaje, setMensaje, procesando, ejecutar };
}

import { useState } from "react";
import type { Cita } from "@portal-tutorias/shared";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { TarjetaCita } from "../../../components/TarjetaCita";
import { apiClient } from "../../../lib/api-client";
import { mensajeDeError, useDatos } from "../../../lib/use-datos";

type Accion = "cancelar" | "propuesta/aceptar" | "propuesta/rechazar";

const ICONO_LISTA = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M8 6.5h11M8 12h11M8 17.5h11" strokeLinecap="round" />
    <circle cx="4.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    <circle cx="4.5" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="4.5" cy="17.5" r="1" fill="currentColor" stroke="none" />
  </svg>
);

/** SWR-14, SWR-21 y respuesta a propuestas de reprogramacion: seguimiento de las citas del estudiante. */
export function MisCitasEstudiante({ aviso }: { aviso?: string }) {
  const { datos, error, recargar } = useDatos<{ citas: Cita[] }>("/citas");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [procesando, setProcesando] = useState<string | null>(null);

  async function ejecutar(citaId: string, accion: Accion) {
    setProcesando(citaId);
    setMensaje(null);
    try {
      await apiClient.post(`/citas/${citaId}/${accion}`);
      setConfirmando(null);
    } catch (err) {
      setMensaje(mensajeDeError(err, "No fue posible completar la acción."));
    } finally {
      setProcesando(null);
      await recargar();
    }
  }

  if (error && !datos) {
    return (
      <p role="alert" className="mensaje-error">
        {error}
      </p>
    );
  }

  if (!datos) {
    return <p className="texto-cargando">Cargando tus tutorías...</p>;
  }

  return (
    <div className="lista-citas">
      {aviso && <p className="mensaje-exito">{aviso}</p>}
      {mensaje && (
        <p role="alert" className="mensaje-error">
          {mensaje}
        </p>
      )}

      {datos.citas.length === 0 ? (
        <EstadoVacio
          icono={ICONO_LISTA}
          titulo="Aún no tienes tutorías"
          texto="Cuando reserves una franja, aquí verás su estado: pendiente, aprobada, rechazada, cancelada o finalizada."
        />
      ) : (
        <ul className="lista-citas__items">
          {datos.citas.map((cita) => (
            <TarjetaCita key={cita.id} cita={cita} vista="estudiante">
              {cita.propuestaPendiente ? (
                <>
                  <button
                    type="button"
                    className="boton boton--primario"
                    disabled={procesando === cita.id}
                    onClick={() => ejecutar(cita.id, "propuesta/aceptar")}
                  >
                    Aceptar propuesta
                  </button>
                  <button
                    type="button"
                    className="boton boton--secundario"
                    disabled={procesando === cita.id}
                    onClick={() => ejecutar(cita.id, "propuesta/rechazar")}
                  >
                    Rechazar propuesta
                  </button>
                </>
              ) : (
                (cita.estado === "PENDIENTE" || cita.estado === "APROBADA") &&
                (confirmando === cita.id ? (
                  <>
                    <span className="tarjeta-cita__nota">¿Cancelar esta tutoría? La franja quedará libre para otros.</span>
                    <button
                      type="button"
                      className="boton boton--peligro"
                      disabled={procesando === cita.id}
                      onClick={() => ejecutar(cita.id, "cancelar")}
                    >
                      Sí, cancelar
                    </button>
                    <button type="button" className="boton boton--secundario" onClick={() => setConfirmando(null)}>
                      Conservar
                    </button>
                  </>
                ) : (
                  <button type="button" className="boton boton--secundario" onClick={() => setConfirmando(cita.id)}>
                    Cancelar tutoría
                  </button>
                ))
              )}
            </TarjetaCita>
          ))}
        </ul>
      )}
    </div>
  );
}

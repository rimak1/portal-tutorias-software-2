import { Fragment, useState } from "react";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { TarjetaCita } from "../../../components/TarjetaCita";
import { EJECUTORES, ETIQUETAS, accionesDisponibles, claseDeBoton, type AccionSimple } from "../../../lib/acciones-cita";
import { citasApi } from "../../../lib/api/citas";
import { useAccionesDeCita } from "../../../lib/use-acciones-cita";
import { useDatos } from "../../../lib/use-datos";

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
  const { datos: citas, error, recargar } = useDatos(citasApi.listar);
  const { mensaje, procesando, ejecutar } = useAccionesDeCita(recargar);
  const [confirmando, setConfirmando] = useState<string | null>(null);

  async function ejecutarSimple(citaId: string, accion: AccionSimple) {
    // Cancelar pide confirmacion en linea antes de ejecutarse.
    if (accion === "cancelar" && confirmando !== citaId) {
      setConfirmando(citaId);
      return;
    }
    if (await ejecutar(citaId, () => EJECUTORES[accion](citaId))) setConfirmando(null);
  }

  if (error && !citas) {
    return (
      <p role="alert" className="mensaje-error">
        {error}
      </p>
    );
  }

  if (!citas) {
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

      {citas.length === 0 ? (
        <EstadoVacio
          icono={ICONO_LISTA}
          titulo="Aún no tienes tutorías"
          texto="Cuando reserves una franja, aquí verás su estado: pendiente, aprobada, rechazada, cancelada o finalizada."
        />
      ) : (
        <ul className="lista-citas__items">
          {citas.map((cita) => (
            <TarjetaCita key={cita.id} cita={cita} vista="estudiante">
              {accionesDisponibles(cita, "estudiante").map((accion) => {
                const simple = accion as AccionSimple;
                if (accion === "cancelar" && confirmando === cita.id) {
                  return (
                    <Fragment key={accion}>
                      <span className="tarjeta-cita__nota">¿Cancelar esta tutoría? La franja quedará libre para otros.</span>
                      <button type="button" className="boton boton--peligro" disabled={procesando === cita.id} onClick={() => ejecutarSimple(cita.id, simple)}>
                        Sí, cancelar
                      </button>
                      <button type="button" className="boton boton--secundario" onClick={() => setConfirmando(null)}>
                        Conservar
                      </button>
                    </Fragment>
                  );
                }
                return (
                  <button key={accion} type="button" className={claseDeBoton(accion)} disabled={procesando === cita.id} onClick={() => ejecutarSimple(cita.id, simple)}>
                    {ETIQUETAS[accion]}
                  </button>
                );
              })}
            </TarjetaCita>
          ))}
        </ul>
      )}
    </div>
  );
}

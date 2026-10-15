import { Fragment, useState } from "react";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { IconoLista } from "../../../components/Iconos";
import { EstadoDeCarga, MensajeError, MensajeExito } from "../../../components/Mensajes";
import { TarjetaCita } from "../../../components/TarjetaCita";
import { EJECUTORES, ETIQUETAS, accionesDisponibles, claseDeBoton, esAccionSimple, type AccionSimple } from "../../../lib/acciones-cita";
import { citasApi } from "../../../lib/api/citas";
import { useAccionesDeCita } from "../../../lib/use-acciones-cita";
import { useDatos } from "../../../lib/use-datos";

/** SWR-14 y SWR-21: el estudiante sigue sus citas, las cancela y responde a las propuestas de reprogramación. */
export function MisCitasEstudiante({ aviso }: { aviso?: string }) {
  const { datos: citas, error, recargar } = useDatos(citasApi.listar);
  const { mensaje, procesando, ejecutar } = useAccionesDeCita(recargar);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  // El aviso de la reserva recién hecha deja de mostrarse en cuanto el estudiante actúa sobre una cita.
  const [avisoVisible, setAvisoVisible] = useState(true);

  async function ejecutarSimple(citaId: string, accion: AccionSimple) {
    setAvisoVisible(false);
    // Cancelar pide confirmación en la misma tarjeta antes de ejecutarse.
    if (accion === "cancelar" && confirmando !== citaId) {
      setConfirmando(citaId);
      return;
    }
    if (await ejecutar(citaId, () => EJECUTORES[accion](citaId))) setConfirmando(null);
  }

  if (!citas) {
    return <EstadoDeCarga error={error} texto="Cargando tus tutorías..." />;
  }

  return (
    <div className="lista-citas">
      {aviso && avisoVisible && <MensajeExito>{aviso}</MensajeExito>}
      {mensaje && <MensajeError>{mensaje}</MensajeError>}

      {citas.length === 0 ? (
        <EstadoVacio
          icono={<IconoLista />}
          titulo="Aún no tienes tutorías"
          texto="Cuando reserves una franja, aquí verás su estado: pendiente, aprobada, rechazada, cancelada o finalizada."
        />
      ) : (
        <ul className="lista-citas__items">
          {citas.map((cita) => (
            <TarjetaCita key={cita.id} cita={cita} vista="estudiante">
              {accionesDisponibles(cita, "estudiante")
                .filter(esAccionSimple)
                .map((accion) => {
                  if (accion === "cancelar" && confirmando === cita.id) {
                    return (
                      <Fragment key={accion}>
                        <span className="tarjeta-cita__nota">¿Cancelar esta tutoría? La franja quedará libre para otros.</span>
                        <button type="button" className="boton boton--peligro" disabled={procesando === cita.id} onClick={() => ejecutarSimple(cita.id, accion)}>
                          Sí, cancelar
                        </button>
                        <button type="button" className="boton boton--secundario" onClick={() => setConfirmando(null)}>
                          Conservar
                        </button>
                      </Fragment>
                    );
                  }
                  return (
                    <button key={accion} type="button" className={claseDeBoton(accion)} disabled={procesando === cita.id} onClick={() => ejecutarSimple(cita.id, accion)}>
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

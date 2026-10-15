import { useState } from "react";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { IconoLista } from "../../../components/Iconos";
import { EstadoDeCarga, MensajeError } from "../../../components/Mensajes";
import { TarjetaCita } from "../../../components/TarjetaCita";
import { EJECUTORES, ETIQUETAS, accionesDisponibles, claseDeBoton, esAccionSimple } from "../../../lib/acciones-cita";
import { citasApi } from "../../../lib/api/citas";
import { useAccionesDeCita } from "../../../lib/use-acciones-cita";
import { useDatos } from "../../../lib/use-datos";
import { PanelDeReprogramacion } from "./PanelDeReprogramacion";
import { PanelDeRechazo } from "./PanelDeRechazo";

type PanelAbierto = { citaId: string; tipo: "rechazar" | "reprogramar" };

/**
 * SWR-10 a SWR-14 y SWR-19: solicitudes recibidas por el tutor. Aprobar y
 * finalizar se ejecutan con un clic; rechazar y reprogramar abren un panel
 * para pedir el motivo o la nueva franja.
 */
export function MisCitasTutor() {
  const { datos: citas, error, recargar } = useDatos(citasApi.listar);
  const { mensaje, procesando, ejecutar } = useAccionesDeCita(recargar);
  const [abierto, setAbierto] = useState<PanelAbierto | null>(null);

  async function confirmar(citaId: string, accion: () => Promise<unknown>) {
    if (await ejecutar(citaId, accion)) setAbierto(null);
  }

  if (!citas) {
    return <EstadoDeCarga error={error} texto="Cargando tus tutorías..." />;
  }

  const ahora = new Date();

  return (
    <div className="lista-citas">
      {mensaje && <MensajeError>{mensaje}</MensajeError>}

      {citas.length === 0 ? (
        <EstadoVacio
          icono={<IconoLista />}
          titulo="Aún no tienes solicitudes"
          texto="Cuando un estudiante reserve una de tus franjas, la solicitud aparecerá aquí para que la apruebes, la rechaces o propongas otro horario."
        />
      ) : (
        <ul className="lista-citas__items">
          {citas.map((cita) => {
            const ocupada = procesando === cita.id;
            const acciones = accionesDisponibles(cita, "tutor", ahora);
            const panelAbierto = abierto?.citaId === cita.id ? abierto.tipo : null;

            return (
              <TarjetaCita key={cita.id} cita={cita} vista="tutor">
                {acciones.includes("finalizar") && (
                  <span className="tarjeta-cita__nota">Ya pasó la hora de inicio: finaliza la tutoría cuando concluya.</span>
                )}
                {cita.estado === "APROBADA" && !acciones.includes("finalizar") && (
                  <span className="tarjeta-cita__nota">Podrás finalizarla desde la hora de inicio.</span>
                )}

                {!panelAbierto &&
                  acciones.map((accion) => (
                    <button
                      key={accion}
                      type="button"
                      className={claseDeBoton(accion)}
                      disabled={ocupada}
                      onClick={() => {
                        if (esAccionSimple(accion)) void ejecutar(cita.id, () => EJECUTORES[accion](cita.id));
                        else setAbierto({ citaId: cita.id, tipo: accion });
                      }}
                    >
                      {ETIQUETAS[accion]}
                    </button>
                  ))}

                {panelAbierto === "rechazar" && (
                  <PanelDeRechazo
                    ocupada={ocupada}
                    onConfirmar={(motivo) => confirmar(cita.id, () => citasApi.rechazar(cita.id, motivo))}
                    onVolver={() => setAbierto(null)}
                  />
                )}

                {panelAbierto === "reprogramar" && (
                  <PanelDeReprogramacion
                    ocupada={ocupada}
                    onEnviar={(franjaId) => confirmar(cita.id, () => citasApi.reprogramar(cita.id, franjaId))}
                    onVolver={() => setAbierto(null)}
                  />
                )}
              </TarjetaCita>
            );
          })}
        </ul>
      )}
    </div>
  );
}

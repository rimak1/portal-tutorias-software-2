import { useState } from "react";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { TarjetaCita } from "../../../components/TarjetaCita";
import { EJECUTORES, ETIQUETAS, accionesDisponibles, claseDeBoton, type AccionSimple } from "../../../lib/acciones-cita";
import { citasApi } from "../../../lib/api/citas";
import { useAccionesDeCita } from "../../../lib/use-acciones-cita";
import { useDatos } from "../../../lib/use-datos";
import { PanelDeReprogramacion } from "./PanelDeReprogramacion";
import { PanelDeRechazo } from "./PanelDeRechazo";

type PanelAbierto = { citaId: string; tipo: "rechazar" | "reprogramar" };

const ICONO_LISTA = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M8 6.5h11M8 12h11M8 17.5h11" strokeLinecap="round" />
    <circle cx="4.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    <circle cx="4.5" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="4.5" cy="17.5" r="1" fill="currentColor" stroke="none" />
  </svg>
);

/**
 * SWR-10 a SWR-14 y SWR-19: lista las solicitudes del tutor y ofrece, segun las
 * reglas por vista, aprobar, rechazar con motivo, reprogramar y finalizar. Los
 * formularios de rechazo y reprogramacion son componentes propios.
 */
export function MisCitasTutor() {
  const { datos: citas, error, recargar } = useDatos(citasApi.listar);
  const { mensaje, procesando, ejecutar } = useAccionesDeCita(recargar);
  const [abierto, setAbierto] = useState<PanelAbierto | null>(null);

  async function confirmar(citaId: string, accion: () => Promise<unknown>) {
    if (await ejecutar(citaId, accion)) setAbierto(null);
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

  const ahora = new Date();

  return (
    <div className="lista-citas">
      {mensaje && (
        <p role="alert" className="mensaje-error">
          {mensaje}
        </p>
      )}

      {citas.length === 0 ? (
        <EstadoVacio
          icono={ICONO_LISTA}
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
                        if (accion === "rechazar" || accion === "reprogramar") setAbierto({ citaId: cita.id, tipo: accion });
                        else void ejecutar(cita.id, () => EJECUTORES[accion as AccionSimple](cita.id));
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

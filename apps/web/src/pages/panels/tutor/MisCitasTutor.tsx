import { useState } from "react";
import type { FranjaPropia } from "@portal-tutorias/shared";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { TarjetaCita } from "../../../components/TarjetaCita";
import { EJECUTORES, ETIQUETAS, accionesDisponibles, claseDeBoton, type AccionSimple } from "../../../lib/acciones-cita";
import { citasApi } from "../../../lib/api/citas";
import { disponibilidadApi } from "../../../lib/api/disponibilidad";
import { formatearFranja } from "../../../lib/fechas";
import { useAccionesDeCita } from "../../../lib/use-acciones-cita";
import { mensajeDeError, useDatos } from "../../../lib/use-datos";

type PanelAbierto = { citaId: string; tipo: "rechazar" | "reprogramar" };

const ICONO_LISTA = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M8 6.5h11M8 12h11M8 17.5h11" strokeLinecap="round" />
    <circle cx="4.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    <circle cx="4.5" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="4.5" cy="17.5" r="1" fill="currentColor" stroke="none" />
  </svg>
);

/** SWR-10 a SWR-14 y SWR-19: el tutor atiende solicitudes (aprobar, rechazar con motivo, reprogramar) y finaliza citas. */
export function MisCitasTutor() {
  const { datos: citas, error, recargar } = useDatos(citasApi.listar);
  const { mensaje, setMensaje, procesando, ejecutar } = useAccionesDeCita(recargar);
  const [abierto, setAbierto] = useState<PanelAbierto | null>(null);
  const [motivo, setMotivo] = useState("");
  const [libres, setLibres] = useState<FranjaPropia[]>([]);
  const [franjaNueva, setFranjaNueva] = useState("");

  function abrirRechazo(citaId: string) {
    setMotivo("");
    setMensaje(null);
    setAbierto({ citaId, tipo: "rechazar" });
  }

  async function abrirReprogramacion(citaId: string) {
    setMensaje(null);
    try {
      const franjas = await disponibilidadApi.listarMiAgenda();
      const disponibles = franjas.filter((f) => f.estado === "LIBRE" && new Date(f.fechaInicio) > new Date());
      setLibres(disponibles);
      setFranjaNueva(disponibles[0]?.id ?? "");
      setAbierto({ citaId, tipo: "reprogramar" });
    } catch (err) {
      setMensaje(mensajeDeError(err, "No fue posible cargar tus franjas libres."));
    }
  }

  async function confirmarRechazo(citaId: string) {
    if (!motivo.trim()) {
      setMensaje("Indica el motivo del rechazo.");
      return;
    }
    if (await ejecutar(citaId, () => citasApi.rechazar(citaId, motivo))) setAbierto(null);
  }

  async function confirmarReprogramacion(citaId: string) {
    if (await ejecutar(citaId, () => citasApi.reprogramar(citaId, franjaNueva))) setAbierto(null);
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
                        if (accion === "rechazar") abrirRechazo(cita.id);
                        else if (accion === "reprogramar") void abrirReprogramacion(cita.id);
                        else void ejecutar(cita.id, () => EJECUTORES[accion as AccionSimple](cita.id));
                      }}
                    >
                      {ETIQUETAS[accion]}
                    </button>
                  ))}

                {panelAbierto === "rechazar" && (
                  <div className="panel-accion">
                    <div className="campo">
                      <label htmlFor={`motivo-${cita.id}`}>Motivo del rechazo (obligatorio)</label>
                      <textarea id={`motivo-${cita.id}`} rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                    </div>
                    <div className="reserva__acciones">
                      <button type="button" className="boton boton--peligro" disabled={ocupada} onClick={() => confirmarRechazo(cita.id)}>
                        Confirmar rechazo
                      </button>
                      <button type="button" className="boton boton--secundario" onClick={() => setAbierto(null)}>
                        Volver
                      </button>
                    </div>
                  </div>
                )}

                {panelAbierto === "reprogramar" && (
                  <div className="panel-accion">
                    {libres.length === 0 ? (
                      <p className="tarjeta-cita__nota">No tienes otras franjas libres. Publica una nueva en «Mi disponibilidad».</p>
                    ) : (
                      <div className="campo">
                        <label htmlFor={`nueva-${cita.id}`}>Nuevo horario</label>
                        <select id={`nueva-${cita.id}`} value={franjaNueva} onChange={(e) => setFranjaNueva(e.target.value)}>
                          {libres.map((franja) => (
                            <option key={franja.id} value={franja.id}>
                              {franja.materia} · {formatearFranja(franja.fechaInicio, franja.fechaFin)}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="reserva__acciones">
                      {libres.length > 0 && (
                        <button
                          type="button"
                          className="boton boton--primario"
                          disabled={ocupada || !franjaNueva}
                          onClick={() => confirmarReprogramacion(cita.id)}
                        >
                          Enviar propuesta
                        </button>
                      )}
                      <button type="button" className="boton boton--secundario" onClick={() => setAbierto(null)}>
                        Volver
                      </button>
                    </div>
                  </div>
                )}
              </TarjetaCita>
            );
          })}
        </ul>
      )}
    </div>
  );
}

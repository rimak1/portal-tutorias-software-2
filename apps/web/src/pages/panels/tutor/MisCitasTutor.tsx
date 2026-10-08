import { useState } from "react";
import type { Cita, FranjaPropia } from "@portal-tutorias/shared";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { TarjetaCita } from "../../../components/TarjetaCita";
import { apiClient } from "../../../lib/api-client";
import { formatearFranja } from "../../../lib/fechas";
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
  const { datos, error, recargar } = useDatos<{ citas: Cita[] }>("/citas");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [procesando, setProcesando] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<PanelAbierto | null>(null);
  const [motivo, setMotivo] = useState("");
  const [libres, setLibres] = useState<FranjaPropia[]>([]);
  const [franjaNueva, setFranjaNueva] = useState("");

  async function ejecutar(citaId: string, accion: string, payload?: object) {
    setProcesando(citaId);
    setMensaje(null);
    try {
      await apiClient.post(`/citas/${citaId}/${accion}`, payload);
      setAbierto(null);
    } catch (err) {
      setMensaje(mensajeDeError(err, "No fue posible completar la acción."));
    } finally {
      setProcesando(null);
      await recargar();
    }
  }

  function abrirRechazo(citaId: string) {
    setMotivo("");
    setMensaje(null);
    setAbierto({ citaId, tipo: "rechazar" });
  }

  async function abrirReprogramacion(citaId: string) {
    setMensaje(null);
    try {
      const { franjas } = await apiClient.get<{ franjas: FranjaPropia[] }>("/disponibilidad/mias");
      const disponibles = franjas.filter((f) => f.estado === "LIBRE" && new Date(f.fechaInicio) > new Date());
      setLibres(disponibles);
      setFranjaNueva(disponibles[0]?.id ?? "");
      setAbierto({ citaId, tipo: "reprogramar" });
    } catch (err) {
      setMensaje(mensajeDeError(err, "No fue posible cargar tus franjas libres."));
    }
  }

  function confirmarRechazo(citaId: string) {
    if (!motivo.trim()) {
      setMensaje("Indica el motivo del rechazo.");
      return;
    }
    ejecutar(citaId, "rechazar", { motivo });
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

  const ahora = new Date();

  return (
    <div className="lista-citas">
      {mensaje && (
        <p role="alert" className="mensaje-error">
          {mensaje}
        </p>
      )}

      {datos.citas.length === 0 ? (
        <EstadoVacio
          icono={ICONO_LISTA}
          titulo="Aún no tienes solicitudes"
          texto="Cuando un estudiante reserve una de tus franjas, la solicitud aparecerá aquí para que la apruebes, la rechaces o propongas otro horario."
        />
      ) : (
        <ul className="lista-citas__items">
          {datos.citas.map((cita) => {
            const ocupada = procesando === cita.id;
            const iniciada = new Date(cita.franja.fechaInicio) <= ahora;

            return (
              <TarjetaCita key={cita.id} cita={cita} vista="tutor">
                {cita.estado === "PENDIENTE" && !cita.propuestaPendiente && abierto?.citaId !== cita.id && (
                  <>
                    <button type="button" className="boton boton--primario" disabled={ocupada} onClick={() => ejecutar(cita.id, "aprobar")}>
                      Aprobar
                    </button>
                    <button type="button" className="boton boton--secundario" disabled={ocupada} onClick={() => abrirRechazo(cita.id)}>
                      Rechazar
                    </button>
                    <button type="button" className="boton boton--secundario" disabled={ocupada} onClick={() => abrirReprogramacion(cita.id)}>
                      Proponer otro horario
                    </button>
                  </>
                )}

                {abierto?.citaId === cita.id && abierto.tipo === "rechazar" && (
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

                {abierto?.citaId === cita.id && abierto.tipo === "reprogramar" && (
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
                          onClick={() => ejecutar(cita.id, "reprogramar", { disponibilidadId: franjaNueva })}
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

                {cita.estado === "APROBADA" &&
                  (iniciada ? (
                    <>
                      <span className="tarjeta-cita__nota">Ya pasó la hora de inicio: finaliza la tutoría cuando concluya.</span>
                      <button type="button" className="boton boton--primario" disabled={ocupada} onClick={() => ejecutar(cita.id, "finalizar")}>
                        Finalizar tutoría
                      </button>
                    </>
                  ) : (
                    <span className="tarjeta-cita__nota">Podrás finalizarla desde la hora de inicio.</span>
                  ))}
              </TarjetaCita>
            );
          })}
        </ul>
      )}
    </div>
  );
}

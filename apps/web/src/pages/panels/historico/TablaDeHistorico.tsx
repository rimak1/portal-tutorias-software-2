import { Fragment, useCallback, useState } from "react";
import type { Cita } from "@portal-tutorias/shared";
import { EstadoCitaBadge } from "../../../components/Insignias";
import { EstadoDeCarga } from "../../../components/Mensajes";
import { historicoApi } from "../../../lib/api/historico";
import { formatearFecha, formatearFranja, formatearHora } from "../../../lib/fechas";
import { ETIQUETA_ESTADO } from "../../../lib/historico-filtros";
import { useDatos } from "../../../lib/use-datos";

/** Una página del histórico; cada fila despliega la bitácora de sus cambios de estado. */
export function TablaDeHistorico({ citas }: { citas: Cita[] }) {
  const [abierta, setAbierta] = useState<string | null>(null);

  return (
    <div className="tabla-contenedor">
      <table className="tabla-datos">
        <caption className="solo-lectores">Tutorías del histórico</caption>
        <thead>
          <tr>
            <th scope="col">Horario</th>
            <th scope="col">Materia</th>
            <th scope="col">Tutor</th>
            <th scope="col">Estudiante</th>
            <th scope="col">Estado</th>
            <th scope="col">Bitácora</th>
          </tr>
        </thead>
        <tbody>
          {citas.map((cita) => {
            const desplegada = abierta === cita.id;
            return (
              <Fragment key={cita.id}>
                <tr>
                  <th scope="row">{formatearFranja(cita.franja.fechaInicio, cita.franja.fechaFin)}</th>
                  <td>{cita.materia}</td>
                  <td>{cita.tutor.nombre}</td>
                  <td>{cita.estudiante.nombre}</td>
                  <td>
                    <EstadoCitaBadge estado={cita.estado} />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="enlace-boton"
                      aria-expanded={desplegada}
                      aria-controls={`bitacora-${cita.id}`}
                      onClick={() => setAbierta(desplegada ? null : cita.id)}
                    >
                      {desplegada ? "Ocultar" : "Ver"}
                    </button>
                  </td>
                </tr>
                {desplegada && (
                  <tr className="fila-edicion" id={`bitacora-${cita.id}`}>
                    <td colSpan={6}>
                      <BitacoraDeCita citaId={cita.id} motivoRechazo={cita.motivoRechazo} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** BR-04: cambios de estado de una cita, con quién los hizo y cuándo. */
function BitacoraDeCita({ citaId, motivoRechazo }: { citaId: string; motivoRechazo: string | null }) {
  const cargar = useCallback(() => historicoApi.detalle(citaId), [citaId]);
  const { datos, error } = useDatos(cargar);

  if (!datos) {
    return <EstadoDeCarga error={error} texto="Cargando la bitácora..." />;
  }

  return (
    <div className="bitacora">
      {motivoRechazo && (
        <p className="tarjeta-cita__motivo">
          <strong>Motivo del rechazo:</strong> {motivoRechazo}
        </p>
      )}
      <ol className="bitacora__eventos">
        {datos.eventos.map((evento, indice) => (
          <li key={indice}>
            <time dateTime={evento.creadoEn}>
              {formatearFecha(evento.creadoEn)}, {formatearHora(evento.creadoEn)}
            </time>
            <span>
              <strong>{evento.estadoAnterior ? `${ETIQUETA_ESTADO[evento.estadoAnterior]} → ` : "Creada → "}{ETIQUETA_ESTADO[evento.estadoNuevo]}</strong>
              {" "}por {evento.actor.nombre}
              {evento.detalle ? `: ${evento.detalle}` : ""}
            </span>
          </li>
        ))}
        {datos.eventos.length === 0 && <li>Esta tutoría no tiene cambios registrados.</li>}
      </ol>
    </div>
  );
}

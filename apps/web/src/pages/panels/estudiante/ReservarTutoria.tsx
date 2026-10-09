import { useCallback, useMemo, useReducer, useState } from "react";
import type { Disponibilidad } from "@portal-tutorias/shared";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { citasApi } from "../../../lib/api/citas";
import { disponibilidadApi } from "../../../lib/api/disponibilidad";
import { materiasApi } from "../../../lib/api/materias";
import { formatearFecha, formatearFranja, formatearHora } from "../../../lib/fechas";
import { mensajeDeError, useDatos } from "../../../lib/use-datos";
import { RESERVA_INICIAL, reservaReducer, type PasoReserva } from "./reserva-wizard";

const NOMBRES_PASOS = ["Elegir tutor", "Elegir franja", "Confirmar"];

const ICONO_CALENDARIO = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
    <path d="M3.5 9.5h17" strokeLinecap="round" />
    <path d="M8 3v3M16 3v3" strokeLinecap="round" />
    <circle cx="8.5" cy="14" r="1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="14" r="1" fill="currentColor" stroke="none" />
  </svg>
);

/**
 * SWR-25: la reserva se completa en tres pasos (elegir tutor, elegir franja,
 * confirmar) y una sola operacion de escritura. El orden de los pasos lo
 * gobierna `reservaReducer`. SWR-06 y SWR-07: las franjas llegan ordenadas por
 * fecha y el filtro por materia lo resuelve el servidor.
 */
export function ReservarTutoria({ onReservada }: { onReservada: () => void }) {
  const [{ paso, materiaId, tutorId, franja, error }, despachar] = useReducer(reservaReducer, RESERVA_INICIAL);
  const [reservando, setReservando] = useState(false);

  const materias = useDatos(materiasApi.listarCatalogo);
  const cargarDisponibilidad = useCallback(() => disponibilidadApi.listar({ materiaId: materiaId || undefined }), [materiaId]);
  const disponibilidad = useDatos(cargarDisponibilidad);

  const lista = disponibilidad.datos;

  const tutores = useMemo(() => {
    const porTutor = new Map<string, { id: string; nombre: string; materias: Set<string>; franjas: Disponibilidad[] }>();
    for (const d of lista ?? []) {
      const actual = porTutor.get(d.tutor.id) ?? { id: d.tutor.id, nombre: d.tutor.nombre, materias: new Set<string>(), franjas: [] };
      actual.materias.add(d.materia);
      actual.franjas.push(d);
      porTutor.set(d.tutor.id, actual);
    }
    // La lista llega ordenada por fecha: el primero de cada tutor es su proxima franja.
    return [...porTutor.values()];
  }, [lista]);

  const tutorElegido = tutores.find((t) => t.id === tutorId) ?? null;

  async function confirmar() {
    if (!franja) return;
    setReservando(true);
    try {
      await citasApi.reservar(franja.id);
      onReservada();
    } catch (err) {
      despachar({ tipo: "RESERVA_RECHAZADA", mensaje: mensajeDeError(err, "No fue posible registrar la reserva.") });
      await disponibilidad.recargar();
    } finally {
      setReservando(false);
    }
  }

  if (disponibilidad.error && !lista) {
    return (
      <p role="alert" className="mensaje-error">
        {disponibilidad.error}
      </p>
    );
  }

  if (!lista) {
    return <p className="texto-cargando">Cargando disponibilidad...</p>;
  }

  return (
    <div className="reserva">
      <ol className="pasos" aria-label="Pasos de la reserva">
        {NOMBRES_PASOS.map((nombre, indice) => {
          const numero = (indice + 1) as PasoReserva;
          const estado = numero === paso ? "actual" : numero < paso ? "hecho" : "pendiente";
          return (
            <li key={nombre} className={`paso paso--${estado}`} aria-current={numero === paso ? "step" : undefined}>
              <span className="paso__numero">{numero}</span>
              <span className="paso__nombre">{nombre}</span>
            </li>
          );
        })}
      </ol>

      {error && (
        <p role="alert" className="mensaje-error">
          {error}
        </p>
      )}

      {paso === 1 && (
        <section className="reserva__seccion">
          <div className="disponibilidad__filtro campo">
            <label htmlFor="materia">Materia</label>
            <select id="materia" value={materiaId} onChange={(e) => despachar({ tipo: "CAMBIAR_MATERIA", materiaId: e.target.value })}>
              <option value="">Todas las materias</option>
              {(materias.datos ?? []).map((materia) => (
                <option key={materia.id} value={materia.id}>
                  {materia.nombre}
                </option>
              ))}
            </select>
          </div>

          {tutores.length === 0 ? (
            materiaId ? (
              <p className="texto-cargando">No hay franjas disponibles para esta materia.</p>
            ) : (
              <EstadoVacio
                icono={ICONO_CALENDARIO}
                titulo="Aún no hay tutorías disponibles"
                texto="Cuando los tutores publiquen sus franjas horarias, las verás aquí para poder reservar tu sesión."
              />
            )
          ) : (
            <ul className="disponibilidad__lista">
              {tutores.map((tutor) => (
                <li key={tutor.id}>
                  <button type="button" className="tarjeta-opcion" onClick={() => despachar({ tipo: "ELEGIR_TUTOR", tutorId: tutor.id })}>
                    <span className="tarjeta-opcion__titulo">{tutor.nombre}</span>
                    <span className="tarjeta-opcion__detalle">{[...tutor.materias].join(" · ")}</span>
                    <span className="tarjeta-opcion__horario">
                      {tutor.franjas.length} {tutor.franjas.length === 1 ? "franja disponible" : "franjas disponibles"} · próxima:{" "}
                      {formatearFecha(tutor.franjas[0].fechaInicio)}, {formatearHora(tutor.franjas[0].fechaInicio)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {paso === 2 && (
        <section className="reserva__seccion">
          <h2>Franjas de {tutorElegido?.nombre ?? "este tutor"}</h2>
          {tutorElegido ? (
            <ul className="disponibilidad__lista">
              {tutorElegido.franjas.map((d) => (
                <li key={d.id}>
                  <button type="button" className="tarjeta-opcion" onClick={() => despachar({ tipo: "ELEGIR_FRANJA", franja: d })}>
                    <span className="tarjeta-opcion__titulo">{d.materia}</span>
                    <span className="tarjeta-opcion__horario">{formatearFranja(d.fechaInicio, d.fechaFin)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="texto-cargando">Este tutor ya no tiene franjas disponibles.</p>
          )}
          <div className="reserva__acciones">
            <button type="button" className="boton boton--secundario" onClick={() => despachar({ tipo: "VOLVER" })}>
              Cambiar de tutor
            </button>
          </div>
        </section>
      )}

      {paso === 3 && franja && (
        <section className="reserva__seccion">
          <h2>Confirma tu reserva</h2>
          <dl className="resumen">
            <div>
              <dt>Tutor</dt>
              <dd>{franja.tutor.nombre}</dd>
            </div>
            <div>
              <dt>Materia</dt>
              <dd>{franja.materia}</dd>
            </div>
            <div>
              <dt>Horario</dt>
              <dd>{formatearFranja(franja.fechaInicio, franja.fechaFin)}</dd>
            </div>
          </dl>
          <p>La solicitud quedará pendiente hasta que el tutor la apruebe, la rechace o proponga otro horario.</p>
          <div className="reserva__acciones">
            <button type="button" className="boton boton--primario" onClick={confirmar} disabled={reservando}>
              {reservando ? "Reservando..." : "Confirmar reserva"}
            </button>
            <button type="button" className="boton boton--secundario" onClick={() => despachar({ tipo: "VOLVER" })} disabled={reservando}>
              Volver
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

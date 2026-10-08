import { useMemo, useState } from "react";
import type { Disponibilidad, Materia } from "@portal-tutorias/shared";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { apiClient } from "../../../lib/api-client";
import { formatearFecha, formatearFranja, formatearHora } from "../../../lib/fechas";
import { mensajeDeError, useDatos } from "../../../lib/use-datos";

type Paso = 1 | 2 | 3;
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
 * confirmar) y una sola operacion de escritura. SWR-06 y SWR-07: las franjas
 * llegan ordenadas por fecha y el filtro por materia lo resuelve el servidor.
 */
export function ReservarTutoria({ onReservada }: { onReservada: () => void }) {
  const [materiaId, setMateriaId] = useState("");
  const [paso, setPaso] = useState<Paso>(1);
  const [tutorId, setTutorId] = useState<string | null>(null);
  const [franja, setFranja] = useState<Disponibilidad | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reservando, setReservando] = useState(false);

  const materias = useDatos<{ materias: Materia[] }>("/materias");
  const disponibilidad = useDatos<{ disponibilidades: Disponibilidad[] }>(
    materiaId ? `/disponibilidad?materiaId=${materiaId}` : "/disponibilidad",
  );

  const lista = disponibilidad.datos?.disponibilidades;

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

  function cambiarMateria(valor: string) {
    setMateriaId(valor);
    setTutorId(null);
    setFranja(null);
    setPaso(1);
    setError(null);
  }

  function elegirTutor(id: string) {
    setTutorId(id);
    setError(null);
    setPaso(2);
  }

  function elegirFranja(elegida: Disponibilidad) {
    setFranja(elegida);
    setError(null);
    setPaso(3);
  }

  async function confirmar() {
    if (!franja) return;
    setReservando(true);
    setError(null);
    try {
      await apiClient.post("/citas", { disponibilidadId: franja.id });
      onReservada();
    } catch (err) {
      setError(mensajeDeError(err, "No fue posible registrar la reserva."));
      setFranja(null);
      setPaso(2);
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
          const numero = (indice + 1) as Paso;
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
            <select id="materia" value={materiaId} onChange={(e) => cambiarMateria(e.target.value)}>
              <option value="">Todas las materias</option>
              {(materias.datos?.materias ?? []).map((materia) => (
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
                  <button type="button" className="tarjeta-opcion" onClick={() => elegirTutor(tutor.id)}>
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
                  <button type="button" className="tarjeta-opcion" onClick={() => elegirFranja(d)}>
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
            <button type="button" className="boton boton--secundario" onClick={() => setPaso(1)}>
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
            <button type="button" className="boton boton--secundario" onClick={() => setPaso(2)} disabled={reservando}>
              Volver
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

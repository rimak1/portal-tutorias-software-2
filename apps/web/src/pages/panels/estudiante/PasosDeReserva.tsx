import type { Disponibilidad, Materia } from "@portal-tutorias/shared";
import { EstadoVacio } from "../../../components/EstadoVacio";
import type { TutorConFranjas } from "../../../lib/agrupar-por-tutor";
import { formatearFecha, formatearFranja, formatearHora } from "../../../lib/fechas";
import type { PasoReserva } from "./reserva-wizard";

/*
 * Un componente por paso de la reserva (SRP): cada uno recibe lo que muestra y
 * avisa lo que el estudiante eligio; ninguno carga datos ni sabe de los demas.
 */

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

export function IndicadorDePasos({ paso }: { paso: PasoReserva }) {
  return (
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
  );
}

export function PasoElegirTutor({
  materias,
  materiaId,
  tutores,
  onCambiarMateria,
  onElegir,
}: {
  materias: Materia[];
  materiaId: string;
  tutores: TutorConFranjas[];
  onCambiarMateria: (materiaId: string) => void;
  onElegir: (tutorId: string) => void;
}) {
  return (
    <section className="reserva__seccion">
      <div className="disponibilidad__filtro campo">
        <label htmlFor="materia">Materia</label>
        <select id="materia" value={materiaId} onChange={(e) => onCambiarMateria(e.target.value)}>
          <option value="">Todas las materias</option>
          {materias.map((materia) => (
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
              <button type="button" className="tarjeta-opcion" onClick={() => onElegir(tutor.id)}>
                <span className="tarjeta-opcion__titulo">{tutor.nombre}</span>
                <span className="tarjeta-opcion__detalle">{tutor.materias.join(" · ")}</span>
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
  );
}

export function PasoElegirFranja({
  tutor,
  onElegir,
  onVolver,
}: {
  tutor: TutorConFranjas | null;
  onElegir: (franja: Disponibilidad) => void;
  onVolver: () => void;
}) {
  return (
    <section className="reserva__seccion">
      <h2>Franjas de {tutor?.nombre ?? "este tutor"}</h2>
      {tutor ? (
        <ul className="disponibilidad__lista">
          {tutor.franjas.map((d) => (
            <li key={d.id}>
              <button type="button" className="tarjeta-opcion" onClick={() => onElegir(d)}>
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
        <button type="button" className="boton boton--secundario" onClick={onVolver}>
          Cambiar de tutor
        </button>
      </div>
    </section>
  );
}

export function PasoConfirmar({
  franja,
  reservando,
  onConfirmar,
  onVolver,
}: {
  franja: Disponibilidad;
  reservando: boolean;
  onConfirmar: () => void;
  onVolver: () => void;
}) {
  return (
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
        <button type="button" className="boton boton--primario" onClick={onConfirmar} disabled={reservando}>
          {reservando ? "Reservando..." : "Confirmar reserva"}
        </button>
        <button type="button" className="boton boton--secundario" onClick={onVolver} disabled={reservando}>
          Volver
        </button>
      </div>
    </section>
  );
}

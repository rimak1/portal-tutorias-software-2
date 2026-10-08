import { useState, type FormEvent } from "react";
import type { FranjaPropia, Materia } from "@portal-tutorias/shared";
import { EstadoFranjaBadge } from "../../../components/Insignias";
import { apiClient } from "../../../lib/api-client";
import { aCamposLocales, deCamposLocales, formatearFranja } from "../../../lib/fechas";
import { mensajeDeError, useDatos } from "../../../lib/use-datos";

/** SWR-03, SWR-04 y SWR-05: el tutor crea, modifica y elimina sus franjas sin traslapes. */
export function MiDisponibilidad({ irAMaterias }: { irAMaterias: () => void }) {
  const materias = useDatos<{ materias: Materia[] }>("/tutores/yo/materias");
  const franjas = useDatos<{ franjas: FranjaPropia[] }>("/disponibilidad/mias");

  const [materiaId, setMateriaId] = useState("");
  const [fecha, setFecha] = useState("");
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFin, setHoraFin] = useState("");
  const [editando, setEditando] = useState<FranjaPropia | null>(null);
  const [confirmandoEliminar, setConfirmandoEliminar] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  if ((materias.error && !materias.datos) || (franjas.error && !franjas.datos)) {
    return (
      <p role="alert" className="mensaje-error">
        {materias.error ?? franjas.error}
      </p>
    );
  }
  if (!materias.datos || !franjas.datos) {
    return <p className="texto-cargando">Cargando tu agenda...</p>;
  }

  if (materias.datos.materias.length === 0) {
    return (
      <div className="aviso-previo">
        <p>Antes de publicar franjas, indica qué materias puedes tutorar.</p>
        <button type="button" className="boton boton--primario" onClick={irAMaterias}>
          Ir a «Mis materias»
        </button>
      </div>
    );
  }

  const materiaElegida = materiaId || materias.datos.materias[0].id;

  function limpiarFormulario() {
    setEditando(null);
    setFecha("");
    setHoraInicio("");
    setHoraFin("");
  }

  function iniciarEdicion(franja: FranjaPropia) {
    const inicio = aCamposLocales(franja.fechaInicio);
    setEditando(franja);
    setMateriaId(franja.materiaId);
    setFecha(inicio.fecha);
    setHoraInicio(inicio.hora);
    setHoraFin(aCamposLocales(franja.fechaFin).hora);
    setError(null);
    setExito(null);
  }

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    setError(null);
    setExito(null);

    const fechaInicio = deCamposLocales(fecha, horaInicio);
    const fechaFin = deCamposLocales(fecha, horaFin);
    if (!fechaInicio || !fechaFin) {
      setError("Completa la fecha y las horas de inicio y de fin.");
      return;
    }
    if (new Date(fechaFin) <= new Date(fechaInicio)) {
      setError("La hora de fin debe ser posterior a la hora de inicio.");
      return;
    }

    setGuardando(true);
    try {
      const datos = { materiaId: materiaElegida, fechaInicio, fechaFin };
      if (editando) {
        await apiClient.patch(`/disponibilidad/${editando.id}`, datos);
      } else {
        await apiClient.post("/disponibilidad", datos);
      }
      setExito(editando ? "Franja actualizada." : "Franja publicada.");
      limpiarFormulario();
      await franjas.recargar();
    } catch (err) {
      setError(mensajeDeError(err, "No fue posible guardar la franja."));
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(id: string) {
    setError(null);
    setExito(null);
    try {
      await apiClient.delete(`/disponibilidad/${id}`);
      setConfirmandoEliminar(null);
      if (editando?.id === id) limpiarFormulario();
      setExito("Franja eliminada.");
    } catch (err) {
      setError(mensajeDeError(err, "No fue posible eliminar la franja."));
    } finally {
      await franjas.recargar();
    }
  }

  return (
    <div className="disponibilidad-tutor">
      <form className="formulario-franja" onSubmit={guardar}>
        <h2>{editando ? "Editar franja" : "Publicar una franja"}</h2>
        <div className="formulario-franja__campos">
          <div className="campo">
            <label htmlFor="franja-materia">Materia</label>
            <select id="franja-materia" value={materiaElegida} onChange={(e) => setMateriaId(e.target.value)}>
              {materias.datos.materias.map((materia) => (
                <option key={materia.id} value={materia.id}>
                  {materia.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="franja-fecha">Fecha</label>
            <input id="franja-fecha" type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor="franja-inicio">Hora de inicio</label>
            <input id="franja-inicio" type="time" required value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor="franja-fin">Hora de fin</label>
            <input id="franja-fin" type="time" required value={horaFin} onChange={(e) => setHoraFin(e.target.value)} />
          </div>
        </div>

        {error && (
          <p role="alert" className="mensaje-error">
            {error}
          </p>
        )}
        {exito && <p className="mensaje-exito">{exito}</p>}

        <div className="reserva__acciones">
          <button type="submit" className="boton boton--primario" disabled={guardando}>
            {guardando ? "Guardando..." : editando ? "Guardar cambios" : "Publicar franja"}
          </button>
          {editando && (
            <button type="button" className="boton boton--secundario" onClick={limpiarFormulario}>
              Cancelar edición
            </button>
          )}
        </div>
      </form>

      <section>
        <h2>Mi agenda</h2>
        {franjas.datos.franjas.length === 0 ? (
          <p className="texto-cargando">Aún no has publicado franjas vigentes.</p>
        ) : (
          <ul className="lista-citas__items">
            {franjas.datos.franjas.map((franja) => (
              <li key={franja.id} className="tarjeta-cita">
                <div className="tarjeta-cita__cabecera">
                  <span className="tarjeta-cita__materia">{franja.materia}</span>
                  <EstadoFranjaBadge estado={franja.estado} />
                </div>
                <span className="tarjeta-cita__horario">{formatearFranja(franja.fechaInicio, franja.fechaFin)}</span>

                {franja.estado === "RESERVADA" ? (
                  <p className="tarjeta-cita__nota">Reservada: gestiona la solicitud en «Mis tutorías».</p>
                ) : (
                  <div className="tarjeta-cita__acciones">
                    {confirmandoEliminar === franja.id ? (
                      <>
                        <span className="tarjeta-cita__nota">¿Eliminar esta franja?</span>
                        <button type="button" className="boton boton--peligro" onClick={() => eliminar(franja.id)}>
                          Sí, eliminar
                        </button>
                        <button type="button" className="boton boton--secundario" onClick={() => setConfirmandoEliminar(null)}>
                          Conservar
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="boton boton--secundario" onClick={() => iniciarEdicion(franja)}>
                          Editar
                        </button>
                        <button type="button" className="boton boton--secundario" onClick={() => setConfirmandoEliminar(franja.id)}>
                          Eliminar
                        </button>
                      </>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

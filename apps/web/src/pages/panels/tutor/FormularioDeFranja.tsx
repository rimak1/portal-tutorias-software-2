import { useEffect, useState, type FormEvent } from "react";
import type { CrearFranjaInput, FranjaPropia, Materia } from "@portal-tutorias/shared";
import { MensajeError, MensajeExito } from "../../../components/Mensajes";
import { aCamposLocales } from "../../../lib/fechas";
import { construirFranja } from "../../../lib/franja-formulario";

interface Props {
  /** Materias del perfil del tutor; la primera se preselecciona en una franja nueva. */
  materias: Materia[];
  /** Si se indica, el formulario edita esa franja; el padre cambia la `key` para reiniciarlo. */
  franjaEnEdicion: FranjaPropia | null;
  guardando: boolean;
  /** Resultado del último guardado, informado por el padre. */
  error: string | null;
  exito: string | null;
  onGuardar: (datos: CrearFranjaInput) => void;
  onCancelarEdicion: () => void;
}

/** Formulario de una franja: valida fecha y horas antes de entregar los datos a `onGuardar`. */
export function FormularioDeFranja({ materias, franjaEnEdicion, guardando, error, exito, onGuardar, onCancelarEdicion }: Props) {
  const inicial = franjaEnEdicion ? aCamposLocales(franjaEnEdicion.fechaInicio) : null;
  const [materiaId, setMateriaId] = useState(franjaEnEdicion?.materiaId ?? materias[0]?.id ?? "");
  const [fecha, setFecha] = useState(inicial?.fecha ?? "");
  const [horaInicio, setHoraInicio] = useState(inicial?.hora ?? "");
  const [horaFin, setHoraFin] = useState(franjaEnEdicion ? aCamposLocales(franjaEnEdicion.fechaFin).hora : "");
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  // Un resultado nuevo del padre (p. ej. "Franja eliminada.") reemplaza el error de validación anterior.
  useEffect(() => {
    setErrorLocal(null);
  }, [error, exito]);

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    const resultado = construirFranja({ materiaId, fecha, horaInicio, horaFin });
    if ("error" in resultado) {
      setErrorLocal(resultado.error);
      return;
    }
    setErrorLocal(null);
    onGuardar(resultado.datos);
  }

  const mensajeDeError = errorLocal ?? error;

  return (
    <form className="formulario-franja" onSubmit={enviar}>
      <h2>{franjaEnEdicion ? "Editar franja" : "Publicar una franja"}</h2>
      <div className="formulario-franja__campos">
        <div className="campo">
          <label htmlFor="franja-materia">Materia</label>
          <select id="franja-materia" value={materiaId} onChange={(e) => setMateriaId(e.target.value)}>
            {materias.map((materia) => (
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

      {mensajeDeError && <MensajeError>{mensajeDeError}</MensajeError>}
      {exito && <MensajeExito>{exito}</MensajeExito>}

      <div className="reserva__acciones">
        <button type="submit" className="boton boton--primario" disabled={guardando}>
          {guardando ? "Guardando..." : franjaEnEdicion ? "Guardar cambios" : "Publicar franja"}
        </button>
        {franjaEnEdicion && (
          <button type="button" className="boton boton--secundario" onClick={onCancelarEdicion}>
            Cancelar edición
          </button>
        )}
      </div>
    </form>
  );
}

import { useState, type FormEvent } from "react";
import type { Materia } from "@portal-tutorias/shared";
import { apiClient } from "../../../lib/api-client";
import { mensajeDeError, useDatos } from "../../../lib/use-datos";

/** SWR-20: el tutor asocia una o mas materias a su perfil. */
export function MisMaterias() {
  const catalogo = useDatos<{ materias: Materia[] }>("/materias");
  const propias = useDatos<{ materias: Materia[] }>("/tutores/yo/materias");
  const [editada, setEditada] = useState<Set<string> | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  if ((catalogo.error && !catalogo.datos) || (propias.error && !propias.datos)) {
    return (
      <p role="alert" className="mensaje-error">
        {catalogo.error ?? propias.error}
      </p>
    );
  }
  if (!catalogo.datos || !propias.datos) {
    return <p className="texto-cargando">Cargando materias...</p>;
  }

  const seleccion = editada ?? new Set(propias.datos.materias.map((m) => m.id));

  function alternar(id: string) {
    const siguiente = new Set(seleccion);
    if (siguiente.has(id)) siguiente.delete(id);
    else siguiente.add(id);
    setEditada(siguiente);
    setExito(null);
  }

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    setGuardando(true);
    setError(null);
    setExito(null);
    try {
      await apiClient.put("/tutores/yo/materias", { materiaIds: [...seleccion] });
      setEditada(null);
      await propias.recargar();
      setExito("Materias guardadas.");
    } catch (err) {
      setError(mensajeDeError(err, "No fue posible guardar las materias."));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form className="formulario-materias" onSubmit={guardar}>
      <p>Marca las materias que puedes tutorar. Solo podrás publicar franjas de estas materias.</p>
      <fieldset className="opciones-materia">
        <legend>Materias que puedo tutorar</legend>
        {catalogo.datos.materias.map((materia) => (
          <label key={materia.id} className="opcion-materia">
            <input type="checkbox" checked={seleccion.has(materia.id)} onChange={() => alternar(materia.id)} />
            <span>{materia.nombre}</span>
          </label>
        ))}
      </fieldset>

      {error && (
        <p role="alert" className="mensaje-error">
          {error}
        </p>
      )}
      {exito && <p className="mensaje-exito">{exito}</p>}

      <div>
        <button type="submit" className="boton boton--primario" disabled={guardando || seleccion.size === 0}>
          {guardando ? "Guardando..." : "Guardar materias"}
        </button>
      </div>
    </form>
  );
}

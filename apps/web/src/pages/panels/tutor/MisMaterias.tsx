import { useState, type FormEvent } from "react";
import { EstadoDeCarga, MensajeError, MensajeExito } from "../../../components/Mensajes";
import { mensajeDeError } from "../../../lib/api-client";
import { materiasApi } from "../../../lib/api/materias";
import { useDatos } from "../../../lib/use-datos";

/** SWR-20: el tutor elige las materias de su perfil; la selección se guarda completa al enviar. */
export function MisMaterias() {
  const catalogo = useDatos(materiasApi.listarCatalogo);
  const propias = useDatos(materiasApi.listarMias);
  const [editada, setEditada] = useState<Set<string> | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  if (!catalogo.datos || !propias.datos) {
    const errorDeCarga = (!catalogo.datos && catalogo.error) || (!propias.datos && propias.error) || null;
    return <EstadoDeCarga error={errorDeCarga} texto="Cargando materias..." />;
  }

  const seleccion = editada ?? new Set(propias.datos.map((m) => m.id));

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
      await materiasApi.guardarMias([...seleccion]);
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
        {catalogo.datos.map((materia) => (
          <label key={materia.id} className="opcion-materia">
            <input type="checkbox" checked={seleccion.has(materia.id)} onChange={() => alternar(materia.id)} />
            <span>{materia.nombre}</span>
          </label>
        ))}
      </fieldset>

      {error && <MensajeError>{error}</MensajeError>}
      {exito && <MensajeExito>{exito}</MensajeExito>}

      <div>
        <button type="submit" className="boton boton--primario" disabled={guardando || seleccion.size === 0}>
          {guardando ? "Guardando..." : "Guardar materias"}
        </button>
      </div>
    </form>
  );
}

import { useState } from "react";
import type { FranjaPropia } from "@portal-tutorias/shared";
import { disponibilidadApi, type DatosDeFranja } from "../../../lib/api/disponibilidad";
import { materiasApi } from "../../../lib/api/materias";
import { mensajeDeError, useDatos } from "../../../lib/use-datos";
import { FormularioDeFranja } from "./FormularioDeFranja";
import { ListaDeFranjas } from "./ListaDeFranjas";

/**
 * SWR-03, SWR-04 y SWR-05: el tutor crea, modifica y elimina sus franjas sin
 * traslapes. Este componente solo coordina: carga los datos, llama a la API y
 * decide cuando mostrar el formulario y la lista.
 */
export function MiDisponibilidad({ irAMaterias }: { irAMaterias: () => void }) {
  const materias = useDatos(materiasApi.listarMias);
  const franjas = useDatos(disponibilidadApi.listarMiAgenda);

  const [enEdicion, setEnEdicion] = useState<FranjaPropia | null>(null);
  // Cambiar la `key` del formulario lo reinicia (campos vacios) despues de guardar.
  const [versionDelFormulario, setVersionDelFormulario] = useState(0);
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

  if (materias.datos.length === 0) {
    return (
      <div className="aviso-previo">
        <p>Antes de publicar franjas, indica qué materias puedes tutorar.</p>
        <button type="button" className="boton boton--primario" onClick={irAMaterias}>
          Ir a «Mis materias»
        </button>
      </div>
    );
  }

  function reiniciarFormulario() {
    setEnEdicion(null);
    setVersionDelFormulario((v) => v + 1);
  }

  function editar(franja: FranjaPropia) {
    setEnEdicion(franja);
    setError(null);
    setExito(null);
  }

  async function guardar(datos: DatosDeFranja) {
    setError(null);
    setExito(null);
    setGuardando(true);
    try {
      if (enEdicion) await disponibilidadApi.actualizar(enEdicion.id, datos);
      else await disponibilidadApi.crear(datos);
      setExito(enEdicion ? "Franja actualizada." : "Franja publicada.");
      reiniciarFormulario();
      await franjas.recargar();
    } catch (err) {
      setError(mensajeDeError(err, "No fue posible guardar la franja."));
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(id: string): Promise<boolean> {
    setError(null);
    setExito(null);
    try {
      await disponibilidadApi.eliminar(id);
      if (enEdicion?.id === id) reiniciarFormulario();
      setExito("Franja eliminada.");
      return true;
    } catch (err) {
      setError(mensajeDeError(err, "No fue posible eliminar la franja."));
      return false;
    } finally {
      await franjas.recargar();
    }
  }

  return (
    <div className="disponibilidad-tutor">
      <FormularioDeFranja
        key={`${enEdicion?.id ?? "nueva"}-${versionDelFormulario}`}
        materias={materias.datos}
        franjaEnEdicion={enEdicion}
        guardando={guardando}
        error={error}
        exito={exito}
        onGuardar={guardar}
        onCancelarEdicion={reiniciarFormulario}
      />

      <section>
        <h2>Mi agenda</h2>
        <ListaDeFranjas franjas={franjas.datos} onEditar={editar} onEliminar={eliminar} />
      </section>
    </div>
  );
}

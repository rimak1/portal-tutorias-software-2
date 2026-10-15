import { useId, useState } from "react";
import { EstadoDeCarga } from "../../../components/Mensajes";
import { disponibilidadApi } from "../../../lib/api/disponibilidad";
import { formatearFranja } from "../../../lib/fechas";
import { useDatos } from "../../../lib/use-datos";

interface Props {
  ocupada: boolean;
  onEnviar: (franjaId: string) => void;
  onVolver: () => void;
}

/** SWR-11: el tutor elige otra de sus franjas libres y futuras como nuevo horario de la cita. */
export function PanelDeReprogramacion({ ocupada, onEnviar, onVolver }: Props) {
  const id = useId();
  const agenda = useDatos(disponibilidadApi.listarMiAgenda);
  const [elegida, setElegida] = useState("");

  if (!agenda.datos) {
    return <EstadoDeCarga error={agenda.error} texto="Cargando tus franjas libres..." />;
  }

  const ahora = new Date();
  const libres = agenda.datos.filter((franja) => franja.estado === "LIBRE" && new Date(franja.fechaInicio) > ahora);
  const franjaNueva = elegida || libres[0]?.id || "";

  return (
    <div className="panel-accion">
      {libres.length === 0 ? (
        <p className="tarjeta-cita__nota">No tienes otras franjas libres. Publica una nueva en «Mi disponibilidad».</p>
      ) : (
        <div className="campo">
          <label htmlFor={id}>Nuevo horario</label>
          <select id={id} value={franjaNueva} onChange={(e) => setElegida(e.target.value)}>
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
          <button type="button" className="boton boton--primario" disabled={ocupada || !franjaNueva} onClick={() => onEnviar(franjaNueva)}>
            Enviar propuesta
          </button>
        )}
        <button type="button" className="boton boton--secundario" onClick={onVolver}>
          Volver
        </button>
      </div>
    </div>
  );
}

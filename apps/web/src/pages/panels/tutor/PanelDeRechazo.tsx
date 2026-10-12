import { useId, useState } from "react";

interface Props {
  ocupada: boolean;
  onConfirmar: (motivo: string) => void;
  onVolver: () => void;
}

/** SWR-12: el motivo del rechazo es obligatorio. Solo captura y valida el motivo. */
export function PanelDeRechazo({ ocupada, onConfirmar, onVolver }: Props) {
  const id = useId();
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);

  function confirmar() {
    if (!motivo.trim()) {
      setError("Indica el motivo del rechazo.");
      return;
    }
    setError(null);
    onConfirmar(motivo);
  }

  return (
    <div className="panel-accion">
      <div className="campo">
        <label htmlFor={id}>Motivo del rechazo (obligatorio)</label>
        <textarea id={id} rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      </div>
      {error && (
        <p role="alert" className="mensaje-error">
          {error}
        </p>
      )}
      <div className="reserva__acciones">
        <button type="button" className="boton boton--peligro" disabled={ocupada} onClick={confirmar}>
          Confirmar rechazo
        </button>
        <button type="button" className="boton boton--secundario" onClick={onVolver}>
          Volver
        </button>
      </div>
    </div>
  );
}

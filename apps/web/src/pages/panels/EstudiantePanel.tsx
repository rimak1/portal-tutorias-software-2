import { PanelLayout } from "./PanelLayout";
import { EstadoVacio } from "../../components/EstadoVacio";

export function EstudiantePanel() {
  return (
    <PanelLayout titulo="Panel del estudiante">
      <EstadoVacio
        icono={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
            <path d="M3.5 9.5h17" strokeLinecap="round" />
            <path d="M8 3v3M16 3v3" strokeLinecap="round" />
            <circle cx="8.5" cy="14" r="1" fill="currentColor" stroke="none" />
            <circle cx="12" cy="14" r="1" fill="currentColor" stroke="none" />
          </svg>
        }
        titulo="Aún no puedes reservar tutorías"
        texto="Aquí verás la disponibilidad de los tutores y podrás agendar tus sesiones. Esta función llega en las próximas entregas del portal."
      />
    </PanelLayout>
  );
}

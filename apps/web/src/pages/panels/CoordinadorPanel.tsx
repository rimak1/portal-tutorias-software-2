import { PanelLayout } from "./PanelLayout";
import { EstadoVacio } from "../../components/EstadoVacio";

export function CoordinadorPanel() {
  return (
    <PanelLayout titulo="Panel del coordinador académico">
      <EstadoVacio
        icono={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="9" cy="9" r="3" />
            <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" strokeLinecap="round" />
            <circle cx="17" cy="8" r="2.25" />
            <path d="M15.25 12.5c2.4 0 4.25 1.7 4.25 4.5" strokeLinecap="round" />
          </svg>
        }
        titulo="Aún no hay tutores registrados"
        texto="Aquí gestionarás el registro de tutores y consultarás el histórico de tutorías realizadas. Esta función llega en una próxima entrega."
      />
    </PanelLayout>
  );
}

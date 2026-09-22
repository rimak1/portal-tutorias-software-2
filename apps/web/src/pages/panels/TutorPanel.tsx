import { PanelLayout } from "./PanelLayout";
import { EstadoVacio } from "../../components/EstadoVacio";

export function TutorPanel() {
  return (
    <PanelLayout
      titulo="Panel del tutor"
      categorias={[
        { etiqueta: "Mi disponibilidad", seleccionada: true, disponible: false },
        { etiqueta: "Mis tutorías", disponible: false },
      ]}
    >
      <EstadoVacio
        icono={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="8.25" />
            <path d="M12 7.5V12l3 2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        }
        titulo="Aún no has configurado tus horarios"
        texto="Aquí podrás definir tus materias y franjas de disponibilidad para que los estudiantes agenden contigo. Esta función llega en una próxima entrega."
      />
    </PanelLayout>
  );
}

import { PanelLayout } from "./PanelLayout";
import { EstadoVacio } from "../../components/EstadoVacio";
import { IconoPersonas } from "../../components/Iconos";

export function CoordinadorPanel() {
  return (
    <PanelLayout
      titulo="Panel del coordinador académico"
      categorias={[
        { etiqueta: "Tutores", seleccionada: true, disponible: false },
        { etiqueta: "Histórico de tutorías", disponible: false },
      ]}
    >
      <EstadoVacio
        icono={<IconoPersonas />}
        titulo="Aún no hay tutores registrados"
        texto="Aquí gestionarás el registro de tutores y consultarás el histórico de tutorías realizadas. Esta función llega en una próxima entrega."
      />
    </PanelLayout>
  );
}

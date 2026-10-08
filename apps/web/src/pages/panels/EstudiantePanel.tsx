import { useState } from "react";
import { PanelLayout } from "./PanelLayout";
import { MisCitasEstudiante } from "./estudiante/MisCitasEstudiante";
import { ReservarTutoria } from "./estudiante/ReservarTutoria";

type Seccion = "disponibilidad" | "mis-citas";

export function EstudiantePanel() {
  const [seccion, setSeccion] = useState<Seccion>("disponibilidad");
  const [aviso, setAviso] = useState<string | undefined>();

  function irA(destino: Seccion) {
    setAviso(undefined);
    setSeccion(destino);
  }

  return (
    <PanelLayout
      titulo="Panel del estudiante"
      categorias={[
        { etiqueta: "Disponibilidad", seleccionada: seccion === "disponibilidad", onSeleccionar: () => irA("disponibilidad") },
        { etiqueta: "Mis tutorías", seleccionada: seccion === "mis-citas", onSeleccionar: () => irA("mis-citas") },
      ]}
    >
      {seccion === "disponibilidad" ? (
        <ReservarTutoria
          onReservada={() => {
            setAviso("Reserva registrada. Quedará pendiente hasta que el tutor responda.");
            setSeccion("mis-citas");
          }}
        />
      ) : (
        <MisCitasEstudiante aviso={aviso} />
      )}
    </PanelLayout>
  );
}

import { useState } from "react";
import { PanelLayout } from "./PanelLayout";
import { MiDisponibilidad } from "./tutor/MiDisponibilidad";
import { MisCitasTutor } from "./tutor/MisCitasTutor";
import { MisMaterias } from "./tutor/MisMaterias";

type Seccion = "disponibilidad" | "materias" | "citas";

export function TutorPanel() {
  const [seccion, setSeccion] = useState<Seccion>("disponibilidad");

  return (
    <PanelLayout
      titulo="Panel del tutor"
      categorias={[
        { etiqueta: "Mi disponibilidad", seleccionada: seccion === "disponibilidad", onSeleccionar: () => setSeccion("disponibilidad") },
        { etiqueta: "Mis materias", seleccionada: seccion === "materias", onSeleccionar: () => setSeccion("materias") },
        { etiqueta: "Mis tutorías", seleccionada: seccion === "citas", onSeleccionar: () => setSeccion("citas") },
      ]}
    >
      {seccion === "disponibilidad" && <MiDisponibilidad irAMaterias={() => setSeccion("materias")} />}
      {seccion === "materias" && <MisMaterias />}
      {seccion === "citas" && <MisCitasTutor />}
    </PanelLayout>
  );
}

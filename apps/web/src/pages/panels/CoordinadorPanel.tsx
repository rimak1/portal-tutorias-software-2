import { useState } from "react";
import { PanelLayout } from "./PanelLayout";
import { GestionDeCuentas } from "./administrador/GestionDeCuentas";
import { HistoricoDeTutorias } from "./historico/HistoricoDeTutorias";

type Seccion = "tutores" | "historico";

/** F-08 y F-09: el coordinador registra tutores y consulta el histórico de tutorías. */
export function CoordinadorPanel() {
  const [seccion, setSeccion] = useState<Seccion>("tutores");

  return (
    <PanelLayout
      titulo="Panel del coordinador académico"
      categorias={[
        { etiqueta: "Tutores", seleccionada: seccion === "tutores", onSeleccionar: () => setSeccion("tutores") },
        { etiqueta: "Histórico de tutorías", seleccionada: seccion === "historico", onSeleccionar: () => setSeccion("historico") },
      ]}
    >
      {seccion === "tutores" ? <GestionDeCuentas titulo="tutores" roles={["TUTOR"]} puedeEditar={false} /> : <HistoricoDeTutorias />}
    </PanelLayout>
  );
}

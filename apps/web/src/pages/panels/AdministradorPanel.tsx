import { useState } from "react";
import { ROLES } from "@portal-tutorias/shared";
import { PanelLayout } from "./PanelLayout";
import { GestionDeCuentas } from "./administrador/GestionDeCuentas";
import { HistoricoDeTutorias } from "./historico/HistoricoDeTutorias";

type Seccion = "cuentas" | "historico";

/** F-08 y F-09: el administrador gestiona las cuentas de todos los roles y consulta el histórico de tutorías. */
export function AdministradorPanel() {
  const [seccion, setSeccion] = useState<Seccion>("cuentas");

  return (
    <PanelLayout
      titulo="Panel del administrador"
      categorias={[
        { etiqueta: "Cuentas de usuario", seleccionada: seccion === "cuentas", onSeleccionar: () => setSeccion("cuentas") },
        { etiqueta: "Histórico de tutorías", seleccionada: seccion === "historico", onSeleccionar: () => setSeccion("historico") },
      ]}
    >
      {seccion === "cuentas" ? <GestionDeCuentas titulo="cuentas" roles={[...ROLES]} puedeEditar /> : <HistoricoDeTutorias />}
    </PanelLayout>
  );
}

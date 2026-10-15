import { PanelLayout } from "./PanelLayout";
import { EstadoVacio } from "../../components/EstadoVacio";
import { IconoEscudo } from "../../components/Iconos";

export function AdministradorPanel() {
  return (
    <PanelLayout
      titulo="Panel del administrador"
      categorias={[{ etiqueta: "Cuentas de usuario", seleccionada: true, disponible: false }]}
    >
      <EstadoVacio
        icono={<IconoEscudo />}
        titulo="Aún no hay cuentas para administrar"
        texto="Aquí podrás crear, editar y desactivar cuentas de usuario del portal. Esta función llega en una próxima entrega."
      />
    </PanelLayout>
  );
}

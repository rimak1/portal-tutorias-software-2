import { PanelLayout } from "./PanelLayout";
import { EstadoVacio } from "../../components/EstadoVacio";

export function AdministradorPanel() {
  return (
    <PanelLayout titulo="Panel del administrador">
      <EstadoVacio
        icono={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 3.5l6.5 2.6v5.1c0 4.3-2.7 7.4-6.5 9.3-3.8-1.9-6.5-5-6.5-9.3V6.1L12 3.5z" strokeLinejoin="round" />
            <path d="M9.25 12l1.9 1.9 3.6-3.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        }
        titulo="Aún no hay cuentas para administrar"
        texto="Aquí podrás crear, editar y desactivar cuentas de usuario del portal. Esta función llega en una próxima entrega."
      />
    </PanelLayout>
  );
}

import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/auth-context";

export function PanelLayout({ titulo, children }: { titulo: string; children: ReactNode }) {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  const inicial = usuario?.nombre?.trim().charAt(0).toUpperCase() ?? "?";

  return (
    <div className="pagina-panel">
      <header className="encabezado-panel">
        <div className="encabezado-panel__marca">
          <span>Portal de Tutorías Académicas</span>
          <h1>{titulo}</h1>
        </div>
        <div className="encabezado-panel__usuario">
          <div className="avatar" aria-hidden="true">
            {inicial}
          </div>
          <span className="encabezado-panel__nombre">{usuario?.nombre}</span>
          <button type="button" className="boton boton--fantasma" onClick={handleLogout}>
            Cerrar sesión
          </button>
        </div>
      </header>
      <main className="contenido-panel">{children}</main>
    </div>
  );
}

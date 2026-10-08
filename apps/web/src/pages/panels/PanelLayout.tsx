import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/auth-context";

export interface CategoriaPanel {
  etiqueta: string;
  seleccionada?: boolean;
  /** false cuando la categoria todavia no tiene una funcion real detras (llega en otra entrega). */
  disponible?: boolean;
  /** Si se indica, la categoria es navegable y selecciona su seccion al hacer clic. */
  onSeleccionar?: () => void;
}

export function PanelLayout({
  titulo,
  categorias,
  children,
}: {
  titulo: string;
  categorias: CategoriaPanel[];
  children: ReactNode;
}) {
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
      <div className="panel-cuerpo">
        <aside className="panel-sidebar">
          <span className="panel-sidebar__titulo">Categorías</span>
          <ul>
            {categorias.map((categoria) => (
              <li
                key={categoria.etiqueta}
                className={[
                  "panel-sidebar__item",
                  categoria.seleccionada ? "panel-sidebar__item--activo" : "",
                  categoria.onSeleccionar ? "panel-sidebar__item--navegable" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {categoria.onSeleccionar ? (
                  <button
                    type="button"
                    className="panel-sidebar__boton"
                    aria-current={categoria.seleccionada ? "page" : undefined}
                    onClick={categoria.onSeleccionar}
                  >
                    {categoria.etiqueta}
                  </button>
                ) : (
                  <>
                    <span>{categoria.etiqueta}</span>
                    {categoria.disponible === false && (
                      <span className="panel-sidebar__etiqueta">Próximamente</span>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        </aside>
        <main className="contenido-panel">{children}</main>
      </div>
    </div>
  );
}

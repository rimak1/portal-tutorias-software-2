import { Navigate, Route, Routes } from "react-router-dom";
import { ROLES } from "@portal-tutorias/shared";
import { useAuth } from "./lib/auth-context";
import { rutaPanelPorRol } from "./lib/rutas-por-rol";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { LoginPage } from "./pages/LoginPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { PANELES } from "./pages/panels/paneles";

function InicioRedirect() {
  const { usuario, cargando } = useAuth();
  if (cargando) return <p className="pagina-centrada">Cargando...</p>;
  if (!usuario) return <Navigate to="/login" replace />;
  return <Navigate to={rutaPanelPorRol(usuario.rol)} replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<InicioRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/recuperar-password" element={<ForgotPasswordPage />} />
      <Route path="/restablecer-password" element={<ResetPasswordPage />} />

      {ROLES.map((rol) => {
        const Panel = PANELES[rol];
        return (
          <Route
            key={rol}
            path={rutaPanelPorRol(rol)}
            element={
              <ProtectedRoute roles={[rol]}>
                <Panel />
              </ProtectedRoute>
            }
          />
        );
      })}

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

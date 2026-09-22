import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth-context";
import { rutaPanelPorRol } from "./lib/rutas-por-rol";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { LoginPage } from "./pages/LoginPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { EstudiantePanel } from "./pages/panels/EstudiantePanel";
import { TutorPanel } from "./pages/panels/TutorPanel";
import { CoordinadorPanel } from "./pages/panels/CoordinadorPanel";
import { AdministradorPanel } from "./pages/panels/AdministradorPanel";

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

      <Route
        path="/estudiante"
        element={
          <ProtectedRoute roles={["ESTUDIANTE"]}>
            <EstudiantePanel />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tutor"
        element={
          <ProtectedRoute roles={["TUTOR"]}>
            <TutorPanel />
          </ProtectedRoute>
        }
      />
      <Route
        path="/coordinador"
        element={
          <ProtectedRoute roles={["COORDINADOR"]}>
            <CoordinadorPanel />
          </ProtectedRoute>
        }
      />
      <Route
        path="/administrador"
        element={
          <ProtectedRoute roles={["ADMINISTRADOR"]}>
            <AdministradorPanel />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

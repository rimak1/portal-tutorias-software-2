import { Navigate } from "react-router-dom";
import type { Rol } from "@portal-tutorias/shared";
import { useAuth } from "../lib/auth-context";

export function ProtectedRoute({ roles, children }: { roles: Rol[]; children: React.ReactNode }) {
  const { usuario, cargando } = useAuth();

  if (cargando) {
    return <p className="pagina-centrada">Cargando...</p>;
  }

  if (!usuario) {
    return <Navigate to="/login" replace />;
  }

  if (!roles.includes(usuario.rol)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

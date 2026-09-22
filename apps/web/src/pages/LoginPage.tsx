import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth-context";
import { ApiError } from "../lib/api-client";
import { rutaPanelPorRol } from "../lib/rutas-por-rol";
import { AuthLayout } from "./AuthLayout";

export function LoginPage() {
  const { usuario, login } = useAuth();
  const location = useLocation();
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (usuario) {
    const destino = (location.state as { from?: string } | null)?.from ?? rutaPanelPorRol(usuario.rol);
    return <Navigate to={destino} replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await login(correo, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No fue posible iniciar sesion.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AuthLayout
      titulo="Un punto de encuentro entre estudiantes y tutores"
      texto="Coordina tus sesiones de acompañamiento académico y da seguimiento a tu proceso, todo en un solo lugar."
    >
      <form onSubmit={handleSubmit} className="tarjeta">
        <h1>Inicia sesión</h1>
        <p>Usa tu cuenta institucional para continuar.</p>

        <div className="campo">
          <label htmlFor="correo">Correo</label>
          <input
            id="correo"
            type="email"
            required
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            autoComplete="username"
            placeholder="nombre@institucion.edu"
          />
        </div>

        <div className="campo">
          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            placeholder="••••••••"
          />
        </div>

        {error && <p role="alert" className="mensaje-error">{error}</p>}

        <button type="submit" className="boton boton--primario" disabled={enviando}>
          {enviando ? "Ingresando..." : "Iniciar sesión"}
        </button>

        <Link to="/recuperar-password" className="enlace-sutil">
          ¿Olvidaste tu contraseña?
        </Link>
      </form>
    </AuthLayout>
  );
}

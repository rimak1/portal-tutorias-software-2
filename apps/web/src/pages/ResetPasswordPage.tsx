import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { apiClient, ApiError } from "../lib/api-client";
import { AuthLayout } from "./AuthLayout";

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (password !== confirmacion) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setEnviando(true);
    try {
      await apiClient.post("/auth/restablecer", { token, password });
      navigate("/login", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No fue posible restablecer la contraseña.");
    } finally {
      setEnviando(false);
    }
  }

  if (!token) {
    return (
      <AuthLayout
        titulo="Este enlace ya no es válido"
        texto="Los enlaces para restablecer la contraseña expiran por seguridad. Solicita uno nuevo para continuar."
      >
        <div className="tarjeta">
          <h1>Enlace no válido</h1>
          <p>El enlace no incluye un token válido.</p>
          <Link to="/recuperar-password" className="enlace-sutil">
            Solicitar un nuevo enlace
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      titulo="Define tu nueva contraseña"
      texto="Elige una contraseña segura que no hayas usado antes en el portal."
    >
      <form onSubmit={handleSubmit} className="tarjeta">
        <h1>Nueva contraseña</h1>

        <div className="campo">
          <label htmlFor="password">Nueva contraseña</label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 8 caracteres"
          />
        </div>

        <div className="campo">
          <label htmlFor="confirmacion">Confirmar contraseña</label>
          <input
            id="confirmacion"
            type="password"
            required
            minLength={8}
            value={confirmacion}
            onChange={(e) => setConfirmacion(e.target.value)}
            placeholder="Repite la contraseña"
          />
        </div>

        {error && <p role="alert" className="mensaje-error">{error}</p>}

        <button type="submit" className="boton boton--primario" disabled={enviando}>
          {enviando ? "Guardando..." : "Guardar contraseña"}
        </button>
      </form>
    </AuthLayout>
  );
}

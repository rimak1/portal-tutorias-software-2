import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../lib/api-client";
import { AuthLayout } from "./AuthLayout";

export function ForgotPasswordPage() {
  const [correo, setCorreo] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setEnviando(true);
    try {
      await apiClient.post("/auth/recuperar", { correo });
    } finally {
      setEnviando(false);
      // La respuesta es identica exista o no la cuenta: no se revela informacion.
      setEnviado(true);
    }
  }

  return (
    <AuthLayout
      titulo="Recupera el acceso a tu cuenta"
      texto="Te enviaremos un enlace seguro a tu correo institucional para definir una nueva contraseña."
    >
      <form onSubmit={handleSubmit} className="tarjeta">
        <h1>Recuperar contraseña</h1>
        {enviado ? (
          <p className="mensaje-exito">
            Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.
          </p>
        ) : (
          <>
            <p>Ingresa tu correo institucional y te enviaremos las instrucciones.</p>
            <div className="campo">
              <label htmlFor="correo">Correo</label>
              <input
                id="correo"
                type="email"
                required
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                placeholder="nombre@institucion.edu"
              />
            </div>
            <button type="submit" className="boton boton--primario" disabled={enviando}>
              {enviando ? "Enviando..." : "Enviar enlace"}
            </button>
          </>
        )}
        <Link to="/login" className="enlace-sutil">
          Volver a iniciar sesión
        </Link>
      </form>
    </AuthLayout>
  );
}

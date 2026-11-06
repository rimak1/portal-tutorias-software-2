import { useState, type FormEvent } from "react";
import type { CrearCuentaInput, Rol } from "@portal-tutorias/shared";
import { MensajeError } from "../../../components/Mensajes";
import { ETIQUETA_ROL, construirCuenta, generarPasswordInicial } from "../../../lib/cuentas";

interface Props {
  /** Roles que quien registra puede asignar: el administrador, todos; el coordinador, solo tutor. */
  roles: Rol[];
  guardando: boolean;
  /** Error del último intento de guardado, informado por el padre (p. ej. correo repetido). */
  error: string | null;
  onGuardar: (datos: CrearCuentaInput) => void;
  onCancelar: () => void;
}

/** F-08: formulario de una cuenta nueva. La contraseña inicial se puede generar y se muestra para entregársela a la persona. */
export function FormularioDeCuenta({ roles, guardando, error, onGuardar, onCancelar }: Props) {
  const [correo, setCorreo] = useState("");
  const [nombre, setNombre] = useState("");
  const [rol, setRol] = useState<Rol>(roles[0]);
  const [password, setPassword] = useState(generarPasswordInicial);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    const resultado = construirCuenta({ correo, nombre, rol, password });
    if ("error" in resultado) {
      setErrorLocal(resultado.error);
      return;
    }
    setErrorLocal(null);
    onGuardar(resultado.datos);
  }

  const mensaje = errorLocal ?? error;

  return (
    <form className="formulario-cuenta" onSubmit={enviar}>
      <h2>Nueva cuenta</h2>
      <div className="formulario-cuenta__campos">
        <div className="campo">
          <label htmlFor="cuenta-nombre">Nombre completo</label>
          <input id="cuenta-nombre" type="text" autoComplete="off" required value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="cuenta-correo">Correo</label>
          <input id="cuenta-correo" type="email" autoComplete="off" required value={correo} onChange={(e) => setCorreo(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="cuenta-rol">Rol</label>
          <select id="cuenta-rol" value={rol} disabled={roles.length === 1} onChange={(e) => setRol(e.target.value as Rol)}>
            {roles.map((opcion) => (
              <option key={opcion} value={opcion}>
                {ETIQUETA_ROL[opcion]}
              </option>
            ))}
          </select>
        </div>
        <div className="campo campo--completo">
          <label htmlFor="cuenta-password">Contraseña inicial</label>
          <div className="campo__con-accion">
            <input id="cuenta-password" type="text" autoComplete="off" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" className="boton boton--secundario" onClick={() => setPassword(generarPasswordInicial())}>
              Generar otra
            </button>
          </div>
        </div>
      </div>
      <p className="formulario-cuenta__nota">
        Entrega esta contraseña a la persona por un medio seguro. Podrá cambiarla desde «¿Olvidaste tu contraseña?». Se muestra al crear la cuenta y no se vuelve a consultar.
      </p>

      {mensaje && <MensajeError>{mensaje}</MensajeError>}

      <div className="reserva__acciones">
        <button type="submit" className="boton boton--primario" disabled={guardando}>
          {guardando ? "Creando..." : "Crear cuenta"}
        </button>
        <button type="button" className="boton boton--secundario" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

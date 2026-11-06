import { useMemo, useState, type FormEvent } from "react";
import type { ActualizarCuentaInput, CrearCuentaInput, Cuenta, Rol } from "@portal-tutorias/shared";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { IconoPersonas } from "../../../components/Iconos";
import { EstadoDeCarga, MensajeError, MensajeExito } from "../../../components/Mensajes";
import { mensajeDeError } from "../../../lib/api-client";
import { cuentasApi } from "../../../lib/api/cuentas";
import { useAuth } from "../../../lib/auth-context";
import { ETIQUETA_ROL, filtrarCuentas, generarPasswordInicial, type FiltroDeCuentas } from "../../../lib/cuentas";
import { formatearFecha } from "../../../lib/fechas";
import { useDatos } from "../../../lib/use-datos";
import { FormularioDeCuenta } from "./FormularioDeCuenta";

interface Props {
  /** Qué se administra, en plural y minúsculas ("cuentas", "tutores"), para los textos. */
  titulo: string;
  /** Roles que se pueden asignar al crear. */
  roles: Rol[];
  /** Solo el administrador edita y desactiva cuentas; el coordinador únicamente registra y consulta tutores. */
  puedeEditar: boolean;
}

const FILTRO_INICIAL: FiltroDeCuentas = { texto: "", rol: "", estado: "" };

/** F-08 (SWR-16): listado, alta, edición y desactivación de cuentas de usuario. */
export function GestionDeCuentas({ titulo, roles, puedeEditar }: Props) {
  const { usuario } = useAuth();
  const { datos: cuentas, error, recargar } = useDatos(cuentasApi.listar);
  const [filtro, setFiltro] = useState(FILTRO_INICIAL);
  const [creando, setCreando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorDeAlta, setErrorDeAlta] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [errorDeAccion, setErrorDeAccion] = useState<string | null>(null);
  const [procesando, setProcesando] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);

  const visibles = useMemo(() => (cuentas ? filtrarCuentas(cuentas, filtro) : []), [cuentas, filtro]);

  if (!cuentas) {
    return <EstadoDeCarga error={error} texto={`Cargando ${titulo}...`} />;
  }

  async function crear(datos: CrearCuentaInput) {
    setGuardando(true);
    setErrorDeAlta(null);
    try {
      const nueva = await cuentasApi.crear(datos);
      setAviso(`Cuenta creada para ${nueva.nombre}. Contraseña inicial: ${datos.password}. Entrégasela por un medio seguro; no volverá a mostrarse.`);
      setCreando(false);
      await recargar();
    } catch (err) {
      setErrorDeAlta(mensajeDeError(err, "No fue posible crear la cuenta."));
    } finally {
      setGuardando(false);
    }
  }

  async function actualizar(cuenta: Cuenta, cambios: ActualizarCuentaInput, exito: string): Promise<boolean> {
    setProcesando(cuenta.id);
    setErrorDeAccion(null);
    setAviso(null);
    try {
      await cuentasApi.actualizar(cuenta.id, cambios);
      setAviso(exito);
      await recargar();
      return true;
    } catch (err) {
      setErrorDeAccion(mensajeDeError(err, "No fue posible guardar los cambios."));
      return false;
    } finally {
      setProcesando(null);
    }
  }

  async function cambiarEstado(cuenta: Cuenta) {
    // Desactivar pide confirmación en la misma fila; reactivar no.
    if (cuenta.activo && confirmando !== cuenta.id) {
      setConfirmando(cuenta.id);
      return;
    }
    const exito = cuenta.activo ? `La cuenta de ${cuenta.nombre} fue desactivada y perdió el acceso.` : `La cuenta de ${cuenta.nombre} fue reactivada.`;
    if (await actualizar(cuenta, { activo: !cuenta.activo }, exito)) setConfirmando(null);
  }

  return (
    <div className="gestion-cuentas">
      <div className="gestion-cuentas__barra">
        <div className="campo">
          <label htmlFor="cuentas-buscar">Buscar</label>
          <input id="cuentas-buscar" type="search" placeholder="Nombre o correo" value={filtro.texto} onChange={(e) => setFiltro({ ...filtro, texto: e.target.value })} />
        </div>
        {roles.length > 1 && (
          <div className="campo">
            <label htmlFor="cuentas-rol">Rol</label>
            <select id="cuentas-rol" value={filtro.rol} onChange={(e) => setFiltro({ ...filtro, rol: e.target.value as FiltroDeCuentas["rol"] })}>
              <option value="">Todos</option>
              {roles.map((rol) => (
                <option key={rol} value={rol}>
                  {ETIQUETA_ROL[rol]}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="campo">
          <label htmlFor="cuentas-estado">Estado</label>
          <select id="cuentas-estado" value={filtro.estado} onChange={(e) => setFiltro({ ...filtro, estado: e.target.value as FiltroDeCuentas["estado"] })}>
            <option value="">Todos</option>
            <option value="activas">Activas</option>
            <option value="desactivadas">Desactivadas</option>
          </select>
        </div>
        {!creando && (
          <button type="button" className="boton boton--primario gestion-cuentas__nueva" onClick={() => { setCreando(true); setAviso(null); setErrorDeAlta(null); }}>
            Nueva cuenta
          </button>
        )}
      </div>

      {creando && (
        <FormularioDeCuenta roles={roles} guardando={guardando} error={errorDeAlta} onGuardar={crear} onCancelar={() => setCreando(false)} />
      )}

      {aviso && <MensajeExito>{aviso}</MensajeExito>}
      {errorDeAccion && <MensajeError>{errorDeAccion}</MensajeError>}

      {visibles.length === 0 ? (
        <EstadoVacio
          icono={<IconoPersonas />}
          titulo={cuentas.length === 0 ? `Aún no hay ${titulo}` : "Ninguna cuenta coincide con la búsqueda"}
          texto={cuentas.length === 0 ? "Crea la primera con «Nueva cuenta»." : "Cambia o limpia los filtros para ver más cuentas."}
        />
      ) : (
        <div className="tabla-contenedor">
          <table className="tabla-datos">
            <caption className="solo-lectores">Lista de {titulo}</caption>
            <thead>
              <tr>
                <th scope="col">Nombre</th>
                <th scope="col">Correo</th>
                <th scope="col">Rol</th>
                <th scope="col">Estado</th>
                <th scope="col">Creada</th>
                {puedeEditar && <th scope="col">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {visibles.map((cuenta) => {
                const esLaPropia = cuenta.id === usuario?.id;
                return (
                  <FilaDeCuenta
                    key={cuenta.id}
                    cuenta={cuenta}
                    puedeEditar={puedeEditar}
                    esLaPropia={esLaPropia}
                    ocupada={procesando === cuenta.id}
                    editando={editando === cuenta.id}
                    confirmando={confirmando === cuenta.id}
                    onEditar={() => { setEditando(cuenta.id); setConfirmando(null); setAviso(null); setErrorDeAccion(null); }}
                    onCancelarEdicion={() => setEditando(null)}
                    onGuardar={async (cambios, exito) => {
                      if (await actualizar(cuenta, cambios, exito)) setEditando(null);
                    }}
                    onCambiarEstado={() => void cambiarEstado(cuenta)}
                    onConservar={() => setConfirmando(null)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface FilaProps {
  cuenta: Cuenta;
  puedeEditar: boolean;
  esLaPropia: boolean;
  ocupada: boolean;
  editando: boolean;
  confirmando: boolean;
  onEditar: () => void;
  onCancelarEdicion: () => void;
  onGuardar: (cambios: ActualizarCuentaInput, exito: string) => Promise<void>;
  onCambiarEstado: () => void;
  onConservar: () => void;
}

function FilaDeCuenta({ cuenta, puedeEditar, esLaPropia, ocupada, editando, confirmando, onEditar, onCancelarEdicion, onGuardar, onCambiarEstado, onConservar }: FilaProps) {
  const [nombre, setNombre] = useState(cuenta.nombre);
  const [password, setPassword] = useState("");
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    const cambios: ActualizarCuentaInput = {};
    if (nombre.trim() !== cuenta.nombre) cambios.nombre = nombre.trim();
    if (password) cambios.password = password;
    if (Object.keys(cambios).length === 0) {
      setErrorLocal("No hay cambios para guardar.");
      return;
    }
    if (cambios.nombre !== undefined && cambios.nombre.length < 2) {
      setErrorLocal("El nombre debe tener al menos 2 caracteres.");
      return;
    }
    if (cambios.password !== undefined && cambios.password.length < 8) {
      setErrorLocal("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    setErrorLocal(null);
    await onGuardar(cambios, cambios.password ? `Se actualizó la cuenta de ${cuenta.nombre}. Entrégale la nueva contraseña por un medio seguro.` : `Se actualizó la cuenta de ${cuenta.nombre}.`);
    setPassword("");
  }

  return (
    <>
      <tr className={cuenta.activo ? undefined : "fila-desactivada"}>
        <th scope="row">
          {cuenta.nombre}
          {esLaPropia && <span className="etiqueta-propia">Tú</span>}
        </th>
        <td>{cuenta.correo}</td>
        <td>{ETIQUETA_ROL[cuenta.rol]}</td>
        <td>
          <span className={cuenta.activo ? "insignia insignia--aprobada" : "insignia insignia--cancelada"}>{cuenta.activo ? "Activa" : "Desactivada"}</span>
        </td>
        <td>{formatearFecha(cuenta.creadoEn)}</td>
        {puedeEditar && (
          <td className="tabla-datos__acciones">
            {confirmando ? (
              <>
                <span className="tarjeta-cita__nota">¿Desactivar? Perderá el acceso de inmediato.</span>
                <button type="button" className="boton boton--peligro" disabled={ocupada} onClick={onCambiarEstado}>
                  Sí, desactivar
                </button>
                <button type="button" className="boton boton--secundario" onClick={onConservar}>
                  Conservar
                </button>
              </>
            ) : (
              <>
                <button type="button" className="boton boton--secundario" disabled={ocupada} onClick={onEditar}>
                  Editar
                </button>
                <button
                  type="button"
                  className={cuenta.activo ? "boton boton--secundario" : "boton boton--primario"}
                  disabled={ocupada || (esLaPropia && cuenta.activo)}
                  title={esLaPropia && cuenta.activo ? "No puedes desactivar tu propia cuenta." : undefined}
                  onClick={onCambiarEstado}
                >
                  {cuenta.activo ? "Desactivar" : "Reactivar"}
                </button>
              </>
            )}
          </td>
        )}
      </tr>
      {editando && (
        <tr className="fila-edicion">
          <td colSpan={6}>
            <form className="formulario-cuenta formulario-cuenta--en-fila" onSubmit={guardar}>
              <div className="formulario-cuenta__campos">
                <div className="campo">
                  <label htmlFor={`nombre-${cuenta.id}`}>Nombre completo</label>
                  <input id={`nombre-${cuenta.id}`} type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} />
                </div>
                <div className="campo">
                  <label htmlFor={`password-${cuenta.id}`}>Nueva contraseña (opcional)</label>
                  <div className="campo__con-accion">
                    <input id={`password-${cuenta.id}`} type="text" autoComplete="off" placeholder="Déjala vacía para no cambiarla" value={password} onChange={(e) => setPassword(e.target.value)} />
                    <button type="button" className="boton boton--secundario" onClick={() => setPassword(generarPasswordInicial())}>
                      Generar
                    </button>
                  </div>
                </div>
              </div>
              {errorLocal && <MensajeError>{errorLocal}</MensajeError>}
              <div className="reserva__acciones">
                <button type="submit" className="boton boton--primario" disabled={ocupada}>
                  {ocupada ? "Guardando..." : "Guardar cambios"}
                </button>
                <button type="button" className="boton boton--secundario" onClick={onCancelarEdicion}>
                  Cancelar
                </button>
              </div>
            </form>
          </td>
        </tr>
      )}
    </>
  );
}

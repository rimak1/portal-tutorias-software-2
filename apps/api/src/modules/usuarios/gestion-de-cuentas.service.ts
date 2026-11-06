import type { ActualizarCuentaInput, Cuenta, CrearCuentaInput, FiltroDeCuentas, Rol } from "@portal-tutorias/shared";
import type { UnidadDeTrabajo } from "../../db/puertos.js";
import { ErrorDeNegocio, conflicto, noEncontrado } from "../../lib/errors.js";
import type { CifradoDePasswords } from "../auth/auth.puertos.js";
import { aCuenta } from "./usuarios.mapper.js";

/** Quien administra cuentas: su rol decide qué cuentas ve y crea. */
export interface Administrador {
  id: string;
  rol: Rol;
}

export const MENSAJE_CUENTA_INEXISTENTE = "La cuenta no existe.";

/**
 * F-08 (SWR-16): el administrador crea, consulta, edita y desactiva cuentas de
 * cualquier rol; el coordinador académico solo registra y consulta tutores.
 */
export class GestionDeCuentasService {
  constructor(
    private readonly uow: UnidadDeTrabajo,
    private readonly cifrado: CifradoDePasswords,
  ) {}

  /** El coordinador solo ve tutores, pida lo que pida el filtro. */
  async listar(quien: Administrador, filtro: FiltroDeCuentas): Promise<Cuenta[]> {
    const rol = quien.rol === "COORDINADOR" ? "TUTOR" : filtro.rol;
    const cuentas = await this.uow.repos.usuarios.listar({ rol, activo: filtro.activo, texto: filtro.q });
    return cuentas.map(aCuenta);
  }

  /**
   * Crea la cuenta con la contraseña inicial que define quien la registra; la
   * persona puede cambiarla después con la recuperación de contraseña.
   *
   * @throws ErrorDeNegocio 403 si un coordinador intenta crear una cuenta que no es de tutor.
   * @throws CorreoYaRegistrado (409) si el correo ya tiene cuenta.
   */
  async crear(quien: Administrador, datos: CrearCuentaInput): Promise<Cuenta> {
    if (quien.rol === "COORDINADOR" && datos.rol !== "TUTOR") {
      throw new ErrorDeNegocio("El coordinador solo puede registrar cuentas de tutor.", 403);
    }
    const passwordHash = await this.cifrado.cifrar(datos.password);
    const cuenta = await this.uow.repos.usuarios.crear({
      correo: datos.correo,
      nombre: datos.nombre,
      rol: datos.rol,
      passwordHash,
      creadoPorId: quien.id,
    });
    return aCuenta(cuenta);
  }

  /**
   * Edita el nombre, el estado o la contraseña de una cuenta.
   *
   * No se puede desactivar la propia cuenta ni la del último administrador
   * activo: el sistema se quedaría sin quien administre. Desactivar una cuenta
   * le quita el acceso de inmediato (RN-001); sus citas y franjas se conservan.
   *
   * @throws ErrorDeNegocio 404 si la cuenta no existe.
   * @throws ErrorDeNegocio 409 si el cambio dejaría al sistema sin administrador activo.
   */
  actualizar(quien: Administrador, cuentaId: string, cambios: ActualizarCuentaInput): Promise<Cuenta> {
    return this.uow.ejecutar(async ({ usuarios }) => {
      const actual = await usuarios.buscarAdministrable(cuentaId);
      if (!actual) {
        throw noEncontrado(MENSAJE_CUENTA_INEXISTENTE);
      }

      const desactiva = cambios.activo === false && actual.activo;
      if (desactiva && actual.id === quien.id) {
        throw conflicto("No puedes desactivar tu propia cuenta.");
      }
      if (desactiva && actual.rol === "ADMINISTRADOR") {
        const activos = await usuarios.bloquearAdministradoresActivos();
        if (activos.filter((id) => id !== actual.id).length === 0) {
          throw conflicto("Debe quedar al menos un administrador activo.");
        }
      }

      const passwordHash = cambios.password ? await this.cifrado.cifrar(cambios.password) : undefined;
      const actualizada = await usuarios.actualizar(cuentaId, { nombre: cambios.nombre, activo: cambios.activo, passwordHash });
      return aCuenta(actualizada);
    });
  }
}

import type { Rol } from "@portal-tutorias/shared";
import { ErrorDeNegocio } from "../../lib/errors.js";

export interface Cuenta {
  id: string;
  correo: string;
  nombre: string;
  rol: Rol;
  activo: boolean;
  passwordHash: string;
}

export type DatosDeSesion = Omit<Cuenta, "passwordHash">;

/** Búsqueda de cuentas con su hash de contraseña, para autenticar y restablecer. */
export interface BuscadorDeCuentas {
  buscarPorCorreo(correo: string): Promise<Cuenta | null>;
  buscarPorId(id: string): Promise<Cuenta | null>;
}

export interface ActualizadorDePassword {
  actualizarPasswordHash(id: string, passwordHash: string): Promise<void>;
}

/** Datos de la cuenta que se revisan en cada petición autenticada (sin el hash de la contraseña). */
export interface ConsultaDeSesion {
  buscarDatosDeSesion(id: string): Promise<DatosDeSesion | null>;
}

/** Cuenta tal como la ven quienes la administran: sin el hash de la contraseña. */
export interface CuentaAdministrable {
  id: string;
  correo: string;
  nombre: string;
  rol: Rol;
  activo: boolean;
  creadoEn: Date;
}

export interface FiltroDeCuentas {
  rol?: Rol;
  activo?: boolean;
  /** Texto que debe aparecer en el nombre o en el correo, sin distinguir mayúsculas. */
  texto?: string;
}

export interface NuevaCuenta {
  correo: string;
  nombre: string;
  rol: Rol;
  passwordHash: string;
  creadoPorId: string;
}

export interface CambiosDeCuenta {
  nombre?: string;
  activo?: boolean;
  passwordHash?: string;
}

/** SWR-16: ya existe una cuenta con ese correo. */
export class CorreoYaRegistrado extends ErrorDeNegocio {
  constructor() {
    super("Ya existe una cuenta con ese correo.", 409);
  }
}

/** Administración de cuentas (F-08). */
export interface AdministracionDeCuentas {
  /** Ordenadas por nombre. */
  listar(filtro: FiltroDeCuentas): Promise<CuentaAdministrable[]>;
  buscarAdministrable(id: string): Promise<CuentaAdministrable | null>;
  /** @throws CorreoYaRegistrado si el correo ya pertenece a otra cuenta. */
  crear(datos: NuevaCuenta): Promise<CuentaAdministrable>;
  actualizar(id: string, cambios: CambiosDeCuenta): Promise<CuentaAdministrable>;
  /**
   * Bloquea las filas de los administradores activos hasta el fin de la
   * transacción y devuelve sus ids; así dos desactivaciones simultáneas no
   * pueden dejar el sistema sin administrador. Requiere transacción.
   */
  bloquearAdministradoresActivos(): Promise<string[]>;
}

export interface RepositorioDeUsuarios extends BuscadorDeCuentas, ActualizadorDePassword, ConsultaDeSesion, AdministracionDeCuentas {}

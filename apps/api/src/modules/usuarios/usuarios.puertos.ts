import type { Rol } from "@portal-tutorias/shared";

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

export interface RepositorioDeUsuarios extends BuscadorDeCuentas, ActualizadorDePassword, ConsultaDeSesion {}

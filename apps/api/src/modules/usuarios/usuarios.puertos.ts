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

/*
 * Interfaces pequenas por rol de uso (ISP): cada cliente depende solo de lo que
 * necesita. El middleware de sesion no tiene por que conocer como se guardan
 * o se cambian las contrasenas.
 */

export interface BuscadorDeCuentas {
  buscarPorCorreo(correo: string): Promise<Cuenta | null>;
  buscarPorId(id: string): Promise<Cuenta | null>;
}

export interface ActualizadorDePassword {
  actualizarPasswordHash(id: string, passwordHash: string): Promise<void>;
}

export interface ConsultaDeSesion {
  buscarDatosDeSesion(id: string): Promise<DatosDeSesion | null>;
}

export interface RepositorioDeUsuarios extends BuscadorDeCuentas, ActualizadorDePassword, ConsultaDeSesion {}

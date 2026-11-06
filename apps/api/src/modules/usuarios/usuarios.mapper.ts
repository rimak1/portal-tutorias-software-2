import type { Cuenta } from "@portal-tutorias/shared";
import type { CuentaAdministrable } from "./usuarios.puertos.js";

/** Convierte una cuenta del dominio en el DTO `Cuenta` que responde la API. */
export function aCuenta(cuenta: CuentaAdministrable): Cuenta {
  return {
    id: cuenta.id,
    correo: cuenta.correo,
    nombre: cuenta.nombre,
    rol: cuenta.rol,
    activo: cuenta.activo,
    creadoEn: cuenta.creadoEn.toISOString(),
  };
}

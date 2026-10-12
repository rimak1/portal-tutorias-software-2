import { noAutenticado } from "../../lib/errors.js";
import { verifyPassword } from "../../lib/hash.js";
import { signSessionToken, type ConfigDeSesion } from "../../lib/token.js";
import type { BuscadorDeCuentas } from "../usuarios/usuarios.puertos.js";

/** RF-001: inicio de sesion. La recuperacion de contrasena es otro caso de uso (RecuperacionDePasswordService). */
export class AuthService {
  constructor(
    private readonly cuentas: BuscadorDeCuentas,
    private readonly config: ConfigDeSesion,
  ) {}

  /** Valida las credenciales y emite el token que viaja en la cookie de sesion. */
  async login(correo: string, password: string) {
    const cuenta = await this.cuentas.buscarPorCorreo(correo);

    // Un solo error y un solo mensaje para correo inexistente, contrasena incorrecta y
    // cuenta desactivada: la respuesta no revela cual de los tres fue.
    if (!cuenta || !(await verifyPassword(cuenta.passwordHash, password)) || !cuenta.activo) {
      throw noAutenticado("Correo o contrasena incorrectos.");
    }

    return {
      token: signSessionToken(this.config, cuenta.id),
      usuario: { id: cuenta.id, correo: cuenta.correo, nombre: cuenta.nombre, rol: cuenta.rol },
    };
  }
}

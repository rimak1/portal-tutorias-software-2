import { noAutenticado } from "../../lib/errors.js";
import type { BuscadorDeCuentas } from "../usuarios/usuarios.puertos.js";
import type { CifradoDePasswords, TokensDeSesion } from "./auth.puertos.js";

/** RF-001: inicio de sesión con correo y contraseña. */
export class AuthService {
  constructor(
    private readonly cuentas: BuscadorDeCuentas,
    private readonly cifrado: CifradoDePasswords,
    private readonly tokens: TokensDeSesion,
  ) {}

  /**
   * Valida las credenciales y emite el token de la cookie de sesión.
   *
   * Correo inexistente, contraseña incorrecta y cuenta desactivada producen el
   * mismo error, para que la respuesta no revele cuál de los tres ocurrió.
   *
   * @throws ErrorDeNegocio 401 si las credenciales no son válidas.
   */
  async login(correo: string, password: string) {
    const cuenta = await this.cuentas.buscarPorCorreo(correo);

    if (!cuenta || !(await this.cifrado.verificar(cuenta.passwordHash, password)) || !cuenta.activo) {
      throw noAutenticado("Correo o contraseña incorrectos.");
    }

    return {
      token: this.tokens.emitir(cuenta.id),
      usuario: { id: cuenta.id, correo: cuenta.correo, nombre: cuenta.nombre, rol: cuenta.rol },
    };
  }
}

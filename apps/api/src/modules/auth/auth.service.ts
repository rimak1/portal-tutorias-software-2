import { noAutenticado } from "../../lib/errors.js";
import type { BuscadorDeCuentas } from "../usuarios/usuarios.puertos.js";
import type { CifradoDePasswords, TokensDeSesion } from "./auth.puertos.js";

/** Contraseña sin dueño; su hash iguala el costo de verificar cuando el correo no existe. */
const PASSWORD_FICTICIA = "sin-cuenta-asociada";

/** RF-001: inicio de sesión con correo y contraseña. */
export class AuthService {
  private hashFicticio?: Promise<string>;

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
   * La contraseña se verifica siempre, aun sin cuenta, para que tampoco lo
   * revele el tiempo de respuesta.
   *
   * @throws ErrorDeNegocio 401 si las credenciales no son válidas.
   */
  async login(correo: string, password: string) {
    const cuenta = await this.cuentas.buscarPorCorreo(correo);
    const hash = cuenta?.passwordHash ?? (await this.obtenerHashFicticio());
    const coincide = await this.cifrado.verificar(hash, password);

    if (!cuenta || !coincide || !cuenta.activo) {
      throw noAutenticado("Correo o contraseña incorrectos.");
    }

    return {
      token: this.tokens.emitir(cuenta.id),
      usuario: { id: cuenta.id, correo: cuenta.correo, nombre: cuenta.nombre, rol: cuenta.rol },
    };
  }

  /** Se calcula una sola vez, con el mismo cifrado (y costo) que los hashes reales. */
  private obtenerHashFicticio(): Promise<string> {
    this.hashFicticio ??= this.cifrado.cifrar(PASSWORD_FICTICIA);
    return this.hashFicticio;
  }
}

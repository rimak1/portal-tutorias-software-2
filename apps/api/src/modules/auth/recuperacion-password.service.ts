import { solicitudInvalida } from "../../lib/errors.js";
import type { Registro } from "../../lib/registro.js";
import type { EmailSender } from "../email/email-sender.js";
import type { ActualizadorDePassword, BuscadorDeCuentas } from "../usuarios/usuarios.puertos.js";
import type { CifradoDePasswords, TokensDeRestablecimiento } from "./auth.puertos.js";

export interface DependenciasDeRecuperacion {
  cuentas: BuscadorDeCuentas & ActualizadorDePassword;
  cifrado: CifradoDePasswords;
  tokens: TokensDeRestablecimiento;
  correo: EmailSender;
  registro: Registro;
  /** URL pública de la aplicación web, base del enlace que se envía por correo. */
  urlWeb: string;
}

const ENLACE_INVALIDO = "El enlace no es válido o venció.";

/** RF-003: restablecimiento de contraseña mediante un enlace de un solo uso enviado al correo registrado. */
export class RecuperacionDePasswordService {
  constructor(private readonly deps: DependenciasDeRecuperacion) {}

  /**
   * Envía el enlace de restablecimiento si la cuenta existe y está activa.
   *
   * Nunca lanza ni cambia su comportamiento según exista o no la cuenta, ni
   * siquiera si el proveedor de correo falla (el fallo solo se registra): así
   * la respuesta no revela qué correos están registrados.
   */
  async solicitar(correo: string): Promise<void> {
    const { cuentas, tokens, urlWeb, registro } = this.deps;
    const cuenta = await cuentas.buscarPorCorreo(correo);
    if (!cuenta || !cuenta.activo) {
      return;
    }

    const token = tokens.emitir(cuenta.id, cuenta.passwordHash);
    const enlace = `${urlWeb}/restablecer-password?token=${encodeURIComponent(token)}`;

    try {
      await this.deps.correo.enviarRecuperacionPassword(cuenta.correo, enlace);
    } catch (error) {
      registro.error({ err: error, cuentaId: cuenta.id }, "No se pudo enviar el correo de restablecimiento");
    }
  }

  /**
   * Define la nueva contraseña de la cuenta dueña del token.
   *
   * @throws ErrorDeNegocio 400 si el token es inválido, venció, pertenece a una
   *   cuenta desactivada o ya se usó (la contraseña cambió después de emitirlo).
   */
  async restablecer(token: string, nuevaPassword: string): Promise<void> {
    const { cuentas, cifrado, tokens } = this.deps;
    const datos = tokens.verificar(token);
    if (!datos) {
      throw solicitudInvalida(ENLACE_INVALIDO);
    }

    const cuenta = await cuentas.buscarPorId(datos.usuarioId);
    if (!cuenta || !cuenta.activo) {
      throw solicitudInvalida(ENLACE_INVALIDO);
    }

    if (tokens.huellaDe(cuenta.passwordHash) !== datos.huellaDePassword) {
      throw solicitudInvalida("El enlace ya fue utilizado.");
    }

    await cuentas.actualizarPasswordHash(cuenta.id, await cifrado.cifrar(nuevaPassword));
  }
}

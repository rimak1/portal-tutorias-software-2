import type { Env } from "../../config/env.js";
import { solicitudInvalida } from "../../lib/errors.js";
import { hashPassword } from "../../lib/hash.js";
import type { Registro } from "../../lib/registro.js";
import {
  passwordFingerprint,
  signResetToken,
  verifyResetToken,
  type ConfigDeRestablecimiento,
} from "../../lib/token.js";
import type { EmailSender } from "../email/email-sender.js";
import type { ActualizadorDePassword, BuscadorDeCuentas } from "../usuarios/usuarios.puertos.js";

export type ConfigDeRecuperacion = ConfigDeRestablecimiento & Pick<Env, "WEB_APP_URL">;

const ENLACE_INVALIDO = "El enlace no es valido o vencio.";

/** RF-003: restablecimiento de contrasena mediante un enlace de un solo uso enviado al correo registrado. */
export class RecuperacionDePasswordService {
  constructor(
    private readonly cuentas: BuscadorDeCuentas & ActualizadorDePassword,
    private readonly config: ConfigDeRecuperacion,
    private readonly emailSender: EmailSender,
    private readonly registro: Registro,
  ) {}

  /**
   * Emite un enlace hacia el correo de la cuenta, si existe y esta activa. La
   * respuesta nunca revela si el correo esta registrado, ni siquiera cuando el
   * proveedor de correo falla: el error se registra y no se propaga.
   */
  async solicitar(correo: string): Promise<void> {
    const cuenta = await this.cuentas.buscarPorCorreo(correo);
    if (!cuenta || !cuenta.activo) {
      return;
    }

    const token = signResetToken(this.config, cuenta.id, cuenta.passwordHash);
    const enlace = `${this.config.WEB_APP_URL}/restablecer-password?token=${encodeURIComponent(token)}`;

    try {
      await this.emailSender.enviarRecuperacionPassword(cuenta.correo, enlace);
    } catch (error) {
      this.registro.error({ err: error, cuentaId: cuenta.id }, "No se pudo enviar el correo de restablecimiento");
    }
  }

  /** Valida el token de un solo uso y define la nueva contrasena. */
  async restablecer(token: string, nuevaPassword: string): Promise<void> {
    const payload = verifyResetToken(this.config, token);
    if (!payload) {
      throw solicitudInvalida(ENLACE_INVALIDO);
    }

    const cuenta = await this.cuentas.buscarPorId(payload.sub);
    if (!cuenta || !cuenta.activo) {
      throw solicitudInvalida(ENLACE_INVALIDO);
    }

    // El enlace deja de servir en cuanto la contrasena cambia una vez (token de un solo uso).
    if (passwordFingerprint(cuenta.passwordHash) !== payload.pwfp) {
      throw solicitudInvalida("El enlace ya fue utilizado.");
    }

    await this.cuentas.actualizarPasswordHash(cuenta.id, await hashPassword(nuevaPassword));
  }
}

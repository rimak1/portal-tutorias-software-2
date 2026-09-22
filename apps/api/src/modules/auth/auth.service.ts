import type { PrismaClient } from "@prisma/client";
import type { Env } from "../../config/env.js";
import { hashPassword, verifyPassword } from "../../lib/hash.js";
import { passwordFingerprint, signResetToken, signSessionToken, verifyResetToken } from "../../lib/token.js";
import type { EmailSender } from "../email/email-sender.js";

export class CredencialesInvalidasError extends Error {}
export class CuentaDesactivadaError extends Error {}
export class TokenRestablecimientoInvalidoError extends Error {}

export class AuthService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly env: Env,
    private readonly emailSender: EmailSender,
  ) {}

  /** RF-001: inicia sesion y emite el token que viaja en la cookie de sesion. */
  async login(correo: string, password: string) {
    const usuario = await this.prisma.usuario.findUnique({ where: { correo } });

    if (!usuario) {
      throw new CredencialesInvalidasError("Correo o contrasena incorrectos.");
    }

    const passwordValida = await verifyPassword(usuario.passwordHash, password);
    if (!passwordValida) {
      throw new CredencialesInvalidasError("Correo o contrasena incorrectos.");
    }

    if (!usuario.activo) {
      throw new CuentaDesactivadaError("La cuenta esta desactivada.");
    }

    const token = signSessionToken(this.env, usuario.id);
    return {
      token,
      usuario: {
        id: usuario.id,
        correo: usuario.correo,
        nombre: usuario.nombre,
        rol: usuario.rol,
      },
    };
  }

  /**
   * RF-003: emite un enlace de un solo uso hacia el correo del usuario, si existe.
   * La respuesta nunca revela si el correo esta registrado.
   */
  async solicitarRecuperacion(correo: string): Promise<void> {
    const usuario = await this.prisma.usuario.findUnique({ where: { correo } });
    if (!usuario || !usuario.activo) {
      return;
    }

    const token = signResetToken(this.env, usuario.id, usuario.passwordHash);
    const enlace = `${this.env.WEB_APP_URL}/restablecer-password?token=${encodeURIComponent(token)}`;
    await this.emailSender.enviarRecuperacionPassword(usuario.correo, enlace);
  }

  /** RF-003: valida el token de un solo uso y define la nueva contrasena. */
  async restablecerPassword(token: string, nuevaPassword: string): Promise<void> {
    const payload = verifyResetToken(this.env, token);
    if (!payload) {
      throw new TokenRestablecimientoInvalidoError("El enlace no es valido o vencio.");
    }

    const usuario = await this.prisma.usuario.findUnique({ where: { id: payload.sub } });
    if (!usuario || !usuario.activo) {
      throw new TokenRestablecimientoInvalidoError("El enlace no es valido o vencio.");
    }

    // El enlace deja de servir en cuanto la contrasena cambia una vez (token de un solo uso).
    if (passwordFingerprint(usuario.passwordHash) !== payload.pwfp) {
      throw new TokenRestablecimientoInvalidoError("El enlace ya fue utilizado.");
    }

    const nuevoHash = await hashPassword(nuevaPassword);
    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { passwordHash: nuevoHash },
    });
  }
}

import nodemailer, { type Transporter } from "nodemailer";
import type { Env } from "../../config/env.js";
import type { EmailSender } from "./email-sender.js";

/** Adaptador de salida real: entrega el enlace de restablecimiento por SMTP (E-01, RES-001). */
export class SmtpEmailSender implements EmailSender {
  private readonly transporter: Transporter;

  constructor(private readonly env: Env) {
    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
    });
  }

  async enviarRecuperacionPassword(destinatario: string, enlace: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.env.SMTP_FROM,
      to: destinatario,
      subject: "Restablecer tu contrasena - Portal de Tutorias",
      text: `Para restablecer tu contrasena visita el siguiente enlace (valido por ${this.env.RESET_TOKEN_TTL_MINUTOS} minutos):\n\n${enlace}\n\nSi no solicitaste este cambio, ignora este mensaje.`,
      html: `<p>Para restablecer tu contrasena haz clic en el siguiente enlace (valido por ${this.env.RESET_TOKEN_TTL_MINUTOS} minutos):</p><p><a href="${enlace}">${enlace}</a></p><p>Si no solicitaste este cambio, ignora este mensaje.</p>`,
    });
  }
}

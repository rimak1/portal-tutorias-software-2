import nodemailer, { type Transporter } from "nodemailer";
import type { Env } from "../../config/env.js";
import type { EmailSender } from "./email-sender.js";
import { correoDeRecuperacion, type Correo } from "./plantillas.js";

export type ConfigDeCorreo = Pick<
  Env,
  "SMTP_HOST" | "SMTP_PORT" | "SMTP_USER" | "SMTP_PASSWORD" | "SMTP_FROM" | "RESET_TOKEN_TTL_MINUTOS"
>;

/** Entrega los correos por SMTP (E-01, RES-001). El contenido lo arman las plantillas. */
export class SmtpEmailSender implements EmailSender {
  private readonly transporter: Transporter;

  constructor(private readonly config: ConfigDeCorreo) {
    this.transporter = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_PORT === 465,
      auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASSWORD } : undefined,
    });
  }

  enviarRecuperacionPassword(destinatario: string, enlace: string): Promise<void> {
    return this.enviar(destinatario, correoDeRecuperacion(enlace, this.config.RESET_TOKEN_TTL_MINUTOS));
  }

  private async enviar(destinatario: string, correo: Correo): Promise<void> {
    await this.transporter.sendMail({
      from: this.config.SMTP_FROM,
      to: destinatario,
      subject: correo.asunto,
      text: correo.texto,
      html: correo.html,
    });
  }
}

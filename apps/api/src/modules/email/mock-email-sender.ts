import type { FastifyBaseLogger } from "fastify";
import type { EmailSender } from "./email-sender.js";

/** Adaptador de desarrollo/pruebas: registra el correo en el log en vez de enviarlo (E-01). */
export class MockEmailSender implements EmailSender {
  constructor(private readonly logger: FastifyBaseLogger) {}

  async enviarRecuperacionPassword(destinatario: string, enlace: string): Promise<void> {
    this.logger.info({ destinatario, enlace }, "[mock-email] Enlace de restablecimiento de contrasena");
  }
}

import type { Registro } from "../../lib/registro.js";
import type { EmailSender } from "./email-sender.js";

/** Para desarrollo y pruebas: escribe el enlace en el log en lugar de enviar el correo. */
export class MockEmailSender implements EmailSender {
  constructor(private readonly registro: Registro) {}

  async enviarRecuperacionPassword(destinatario: string, enlace: string): Promise<void> {
    this.registro.info({ destinatario, enlace }, "[mock-email] Enlace de restablecimiento de contraseña");
  }
}

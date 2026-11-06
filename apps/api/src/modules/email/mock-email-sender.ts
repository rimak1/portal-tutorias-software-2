import type { Registro } from "../../lib/registro.js";
import type { EmailSender } from "./email-sender.js";

/**
 * Para desarrollo y pruebas: escribe el enlace en el log en lugar de enviar el correo.
 * Con `registrarEnlace` en false (producción) el log solo dice a quién iba dirigido:
 * el enlace restablece una contraseña y no debe quedar en los registros.
 */
export class MockEmailSender implements EmailSender {
  constructor(
    private readonly registro: Registro,
    private readonly registrarEnlace = true,
  ) {}

  async enviarRecuperacionPassword(destinatario: string, enlace: string): Promise<void> {
    const datos = this.registrarEnlace ? { destinatario, enlace } : { destinatario };
    this.registro.info(datos, "[mock-email] Enlace de restablecimiento de contraseña");
  }
}

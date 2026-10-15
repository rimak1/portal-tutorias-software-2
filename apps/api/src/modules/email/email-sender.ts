/**
 * Envío de correos de la plataforma (E-01, única integración externa).
 *
 * Toda implementación debe:
 * - resolver cuando el proveedor aceptó el correo y lanzar si no pudo entregarlo;
 * - comportarse igual exista o no la cuenta del destinatario: esa decisión es
 *   de quien envía, y nunca debe llegar al usuario.
 */
export interface EmailSender {
  enviarRecuperacionPassword(destinatario: string, enlace: string): Promise<void>;
}

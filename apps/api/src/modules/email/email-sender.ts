/**
 * Puerto de salida del correo (E-01).
 *
 * Contrato que toda implementacion debe respetar para ser intercambiable (LSP):
 * - Resuelve cuando el correo fue entregado al proveedor y LANZA si no pudo.
 * - No devuelve ni lanza nada que dependa de si la cuenta existe: eso lo decide
 *   quien lo usa, y nunca debe filtrarse al usuario.
 */
export interface EmailSender {
  enviarRecuperacionPassword(destinatario: string, enlace: string): Promise<void>;
}

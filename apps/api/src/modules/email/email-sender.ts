export interface EmailSender {
  enviarRecuperacionPassword(destinatario: string, enlace: string): Promise<void>;
}

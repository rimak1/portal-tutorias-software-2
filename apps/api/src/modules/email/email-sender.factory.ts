import type { Env } from "../../config/env.js";
import type { Registro } from "../../lib/registro.js";
import type { EmailSender } from "./email-sender.js";
import { MockEmailSender } from "./mock-email-sender.js";
import { SmtpEmailSender } from "./smtp-email-sender.js";

type Adaptador = (env: Env, registro: Registro) => EmailSender;

/**
 * Registro de adaptadores (OCP): para soportar otro proveedor se agrega una
 * entrada (y su valor en EMAIL_ADAPTER); esta funcion no cambia. El resto del
 * sistema solo conoce la interfaz EmailSender (E-01).
 */
const ADAPTADORES: Record<Env["EMAIL_ADAPTER"], Adaptador> = {
  mock: (_env, registro) => new MockEmailSender(registro),
  smtp: (env) => new SmtpEmailSender(env),
};

export function crearEmailSender(env: Env, registro: Registro): EmailSender {
  return ADAPTADORES[env.EMAIL_ADAPTER](env, registro);
}

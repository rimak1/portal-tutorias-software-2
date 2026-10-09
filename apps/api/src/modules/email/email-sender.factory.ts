import type { FastifyBaseLogger } from "fastify";
import type { Env } from "../../config/env.js";
import type { EmailSender } from "./email-sender.js";
import { MockEmailSender } from "./mock-email-sender.js";
import { SmtpEmailSender } from "./smtp-email-sender.js";

/**
 * Factory: elige el adaptador de correo (Strategy) segun la configuracion del
 * entorno. El resto del sistema solo conoce la interfaz EmailSender (E-01).
 */
export function crearEmailSender(env: Env, logger: FastifyBaseLogger): EmailSender {
  return env.EMAIL_ADAPTER === "smtp" ? new SmtpEmailSender(env) : new MockEmailSender(logger);
}

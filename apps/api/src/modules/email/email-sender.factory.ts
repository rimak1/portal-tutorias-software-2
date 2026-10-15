import type { Env } from "../../config/env.js";
import type { Registro } from "../../lib/registro.js";
import type { EmailSender } from "./email-sender.js";
import { MockEmailSender } from "./mock-email-sender.js";
import { SmtpEmailSender } from "./smtp-email-sender.js";

type Adaptador = (env: Env, registro: Registro) => EmailSender;

/** Un adaptador por valor de `EMAIL_ADAPTER`; un proveedor nuevo es una entrada más. */
const ADAPTADORES: Record<Env["EMAIL_ADAPTER"], Adaptador> = {
  mock: (_env, registro) => new MockEmailSender(registro),
  smtp: (env) => new SmtpEmailSender(env),
};

/** Crea el EmailSender configurado en `EMAIL_ADAPTER`. */
export function crearEmailSender(env: Env, registro: Registro): EmailSender {
  return ADAPTADORES[env.EMAIL_ADAPTER](env, registro);
}

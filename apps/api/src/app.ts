import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import sensible from "@fastify/sensible";
import type { Env } from "./config/env.js";
import prismaPlugin from "./plugins/prisma.js";
import sessionPlugin from "./middleware/session.js";
import authRoutes from "./modules/auth/auth.routes.js";
import disponibilidadRoutes from "./modules/disponibilidad/disponibilidad.routes.js";
import materiasRoutes from "./modules/materias/materias.routes.js";
import citasRoutes from "./modules/citas/citas.routes.js";
import { MockEmailSender } from "./modules/email/mock-email-sender.js";
import { SmtpEmailSender } from "./modules/email/smtp-email-sender.js";
import type { EmailSender } from "./modules/email/email-sender.js";

export interface OpcionesApp {
  /** Permite sustituir el adaptador de correo (p. ej. para registrar los envios en las pruebas). */
  emailSender?: EmailSender;
}

export async function buildApp(env: Env, opciones: OpcionesApp = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "test" ? "silent" : "info",
      transport: env.NODE_ENV === "development" ? { target: "pino-pretty" } : undefined,
    },
  });

  await app.register(sensible);
  await app.register(cors, { origin: env.WEB_APP_URL, credentials: true });
  await app.register(cookie);
  await app.register(prismaPlugin);
  await app.register(sessionPlugin, { env });

  const emailSender: EmailSender =
    opciones.emailSender ??
    (env.EMAIL_ADAPTER === "smtp" ? new SmtpEmailSender(env) : new MockEmailSender(app.log));

  app.get("/api/salud", async () => ({ estado: "ok" }));

  await app.register(
    async (instance) => {
      await instance.register(authRoutes, { env, emailSender });
      await instance.register(disponibilidadRoutes);
      await instance.register(materiasRoutes);
      await instance.register(citasRoutes);
    },
    { prefix: "/api" },
  );

  return app;
}

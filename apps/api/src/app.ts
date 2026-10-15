import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import sensible from "@fastify/sensible";
import type { Env } from "./config/env.js";
import { crearContenedor } from "./contenedor.js";
import type { Reloj } from "./lib/reloj.js";
import { crearCookieDeSesion } from "./middleware/cookie-de-sesion.js";
import { registrarManejadorDeErrores } from "./middleware/manejador-de-errores.js";
import sessionPlugin from "./middleware/session.js";
import prismaPlugin from "./plugins/prisma.js";
import authRoutes from "./modules/auth/auth.routes.js";
import disponibilidadRoutes from "./modules/disponibilidad/disponibilidad.routes.js";
import materiasRoutes from "./modules/materias/materias.routes.js";
import citasRoutes from "./modules/citas/citas.routes.js";
import type { EmailSender } from "./modules/email/email-sender.js";
import { crearEmailSender } from "./modules/email/email-sender.factory.js";

export interface OpcionesApp {
  /** Reemplaza el adaptador de correo, p. ej. para registrar los envíos en las pruebas. */
  emailSender?: EmailSender;
  /** Fija la hora del sistema, p. ej. para probar reglas que dependen de "ahora". */
  reloj?: Reloj;
}

/** Arma la aplicación HTTP completa: plugins, manejo de errores, sesión y rutas bajo `/api`. */
export async function buildApp(env: Env, opciones: OpcionesApp = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "test" ? "silent" : "info",
      transport: env.NODE_ENV === "development" ? { target: "pino-pretty" } : undefined,
    },
  });

  registrarManejadorDeErrores(app);
  await app.register(sensible);
  await app.register(cors, { origin: env.WEB_APP_URL, credentials: true });
  await app.register(cookie);
  await app.register(prismaPlugin);

  const contenedor = crearContenedor({
    prisma: app.prisma,
    env,
    emailSender: opciones.emailSender ?? crearEmailSender(env, app.log),
    registro: app.log,
    reloj: opciones.reloj,
  });
  const cookieDeSesion = crearCookieDeSesion(env);

  await app.register(sessionPlugin, {
    cookie: cookieDeSesion,
    tokens: contenedor.tokensDeSesion,
    usuarios: contenedor.sesiones,
  });

  app.get("/api/salud", async () => ({ estado: "ok" }));

  await app.register(
    async (instance) => {
      await instance.register(authRoutes, {
        cookie: cookieDeSesion,
        auth: contenedor.auth,
        recuperacion: contenedor.recuperacion,
      });
      await instance.register(disponibilidadRoutes, {
        consulta: contenedor.consultaDisponibilidad,
        gestion: contenedor.gestionFranjas,
      });
      await instance.register(materiasRoutes, { materias: contenedor.materias });
      await instance.register(citasRoutes, { estudiante: contenedor.citasEstudiante, tutor: contenedor.citasTutor });
    },
    { prefix: "/api" },
  );

  return app;
}

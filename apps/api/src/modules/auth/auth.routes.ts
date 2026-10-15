import type { FastifyPluginAsync } from "fastify";
import {
  loginSchema,
  restablecerPasswordSchema,
  solicitarRecuperacionSchema,
} from "@portal-tutorias/shared";
import { validar } from "../../lib/validacion.js";
import type { CookieDeSesion } from "../../middleware/cookie-de-sesion.js";
import type { AuthService } from "./auth.service.js";
import type { RecuperacionDePasswordService } from "./recuperacion-password.service.js";

export interface AuthRoutesOptions {
  cookie: CookieDeSesion;
  auth: AuthService;
  recuperacion: RecuperacionDePasswordService;
}

/**
 * RF-001 a RF-003: inicio y cierre de sesión, solicitud del enlace de
 * restablecimiento y definición de la nueva contraseña. Todas las rutas son
 * públicas excepto el cierre y la consulta de la sesión.
 */
const authRoutes: FastifyPluginAsync<AuthRoutesOptions> = async (fastify, { cookie, auth, recuperacion }) => {
  fastify.post("/auth/login", async (request, reply) => {
    const { correo, password } = validar(loginSchema, request.body, "Correo y contraseña son obligatorios.");
    const { token, usuario } = await auth.login(correo, password);
    cookie.escribir(reply, token);
    return reply.send({ usuario });
  });

  fastify.post("/auth/logout", { preHandler: fastify.requireAuth() }, async (_request, reply) => {
    cookie.borrar(reply);
    return reply.send({ ok: true });
  });

  fastify.get("/auth/sesion", { preHandler: fastify.requireAuth() }, async (request, reply) => {
    return reply.send({ usuario: request.usuario });
  });

  // La respuesta es la misma exista o no la cuenta, para no revelar qué correos están registrados.
  fastify.post("/auth/recuperar", async (request, reply) => {
    const { correo } = validar(solicitarRecuperacionSchema, request.body, "Correo inválido.");
    await recuperacion.solicitar(correo);
    return reply.send({ ok: true });
  });

  fastify.post("/auth/restablecer", async (request, reply) => {
    const { token, password } = validar(
      restablecerPasswordSchema,
      request.body,
      "Datos inválidos para restablecer la contraseña.",
    );
    await recuperacion.restablecer(token, password);
    return reply.send({ ok: true });
  });
};

export default authRoutes;

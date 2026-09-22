import type { FastifyPluginAsync } from "fastify";
import {
  loginSchema,
  restablecerPasswordSchema,
  solicitarRecuperacionSchema,
} from "@portal-tutorias/shared";
import type { Env } from "../../config/env.js";
import {
  AuthService,
  CredencialesInvalidasError,
  CuentaDesactivadaError,
  TokenRestablecimientoInvalidoError,
} from "./auth.service.js";
import type { EmailSender } from "../email/email-sender.js";

const MENSAJE_CREDENCIALES_INVALIDAS = "Correo o contrasena incorrectos.";

export interface AuthRoutesOptions {
  env: Env;
  emailSender: EmailSender;
}

/**
 * RF-001 a RF-003: inicio y cierre de sesion, solicitud y aplicacion del
 * restablecimiento de contrasena. Rutas publicas salvo /auth/logout.
 */
const authRoutes: FastifyPluginAsync<AuthRoutesOptions> = async (fastify, { env, emailSender }) => {
  const authService = new AuthService(fastify.prisma, env, emailSender);

  fastify.post("/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.badRequest("Correo y contrasena son obligatorios.");
    }

    try {
      const { token, usuario } = await authService.login(parsed.data.correo, parsed.data.password);

      reply.setCookie(env.SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: env.SESSION_TTL_HORAS * 60 * 60,
      });

      return reply.send({ usuario });
    } catch (error) {
      if (error instanceof CredencialesInvalidasError || error instanceof CuentaDesactivadaError) {
        // Mensaje generico: no se revela si la cuenta existe o esta desactivada.
        return reply.unauthorized(MENSAJE_CREDENCIALES_INVALIDAS);
      }
      throw error;
    }
  });

  fastify.post(
    "/auth/logout",
    { preHandler: fastify.requireAuth() },
    async (request, reply) => {
      reply.clearCookie(env.SESSION_COOKIE_NAME, { path: "/" });
      return reply.send({ ok: true });
    },
  );

  fastify.get(
    "/auth/sesion",
    { preHandler: fastify.requireAuth() },
    async (request, reply) => {
      return reply.send({ usuario: request.usuario });
    },
  );

  fastify.post("/auth/recuperar", async (request, reply) => {
    const parsed = solicitarRecuperacionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.badRequest("Correo invalido.");
    }

    await authService.solicitarRecuperacion(parsed.data.correo);
    // Respuesta identica exista o no la cuenta, para no filtrar informacion.
    return reply.send({ ok: true });
  });

  fastify.post("/auth/restablecer", async (request, reply) => {
    const parsed = restablecerPasswordSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.badRequest("Datos invalidos para restablecer la contrasena.");
    }

    try {
      await authService.restablecerPassword(parsed.data.token, parsed.data.password);
      return reply.send({ ok: true });
    } catch (error) {
      if (error instanceof TokenRestablecimientoInvalidoError) {
        return reply.badRequest(error.message);
      }
      throw error;
    }
  });
};

export default authRoutes;

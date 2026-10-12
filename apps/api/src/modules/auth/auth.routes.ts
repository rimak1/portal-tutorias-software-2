import type { FastifyPluginAsync } from "fastify";
import {
  loginSchema,
  restablecerPasswordSchema,
  solicitarRecuperacionSchema,
} from "@portal-tutorias/shared";
import type { Env } from "../../config/env.js";
import type { AuthService } from "./auth.service.js";
import type { RecuperacionDePasswordService } from "./recuperacion-password.service.js";

export interface AuthRoutesOptions {
  env: Pick<Env, "SESSION_COOKIE_NAME" | "SESSION_TTL_HORAS" | "NODE_ENV">;
  auth: AuthService;
  recuperacion: RecuperacionDePasswordService;
}

/**
 * RF-001 a RF-003: inicio y cierre de sesion, solicitud y aplicacion del
 * restablecimiento de contrasena. Rutas publicas salvo /auth/logout. Los
 * servicios lanzan ErrorDeNegocio y Fastify lo traduce: la ruta no conoce
 * cada tipo de error.
 */
const authRoutes: FastifyPluginAsync<AuthRoutesOptions> = async (fastify, { env, auth, recuperacion }) => {
  fastify.post("/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.badRequest("Correo y contrasena son obligatorios.");
    }

    const { token, usuario } = await auth.login(parsed.data.correo, parsed.data.password);

    reply.setCookie(env.SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: env.SESSION_TTL_HORAS * 60 * 60,
    });

    return reply.send({ usuario });
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

    await recuperacion.solicitar(parsed.data.correo);
    // Respuesta identica exista o no la cuenta, para no filtrar informacion.
    return reply.send({ ok: true });
  });

  fastify.post("/auth/restablecer", async (request, reply) => {
    const parsed = restablecerPasswordSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.badRequest("Datos invalidos para restablecer la contrasena.");
    }

    await recuperacion.restablecer(parsed.data.token, parsed.data.password);
    return reply.send({ ok: true });
  });
};

export default authRoutes;

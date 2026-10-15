import type { FastifyReply, FastifyRequest } from "fastify";
import type { Env } from "../config/env.js";

export type ConfigDeCookie = Pick<Env, "SESSION_COOKIE_NAME" | "SESSION_TTL_HORAS" | "NODE_ENV">;

export interface CookieDeSesion {
  leer(request: FastifyRequest): string | undefined;
  escribir(reply: FastifyReply, token: string): void;
  borrar(reply: FastifyReply): void;
}

/**
 * Única definición de la cookie de sesión (nombre, alcance y seguridad). La
 * usan el inicio y el cierre de sesión y la validación de cada petición, de
 * modo que escribir y borrar la cookie nunca usen opciones distintas.
 */
export function crearCookieDeSesion(config: ConfigDeCookie): CookieDeSesion {
  const nombre = config.SESSION_COOKIE_NAME;
  const ruta = "/";

  return {
    leer: (request) => request.cookies[nombre],
    escribir: (reply, token) => {
      reply.setCookie(nombre, token, {
        httpOnly: true,
        secure: config.NODE_ENV === "production",
        sameSite: "lax",
        path: ruta,
        maxAge: config.SESSION_TTL_HORAS * 60 * 60,
      });
    },
    borrar: (reply) => {
      reply.clearCookie(nombre, { path: ruta });
    },
  };
}

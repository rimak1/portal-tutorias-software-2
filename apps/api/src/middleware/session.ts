import fp from "fastify-plugin";
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import type { Rol } from "@portal-tutorias/shared";
import type { Env } from "../config/env.js";
import { verifySessionToken } from "../lib/token.js";
import type { UsuariosRepository } from "../modules/usuarios/usuarios.repository.js";

export interface UsuarioAutenticado {
  id: string;
  correo: string;
  nombre: string;
  rol: Rol;
}

declare module "fastify" {
  interface FastifyInstance {
    requireAuth: (roles?: Rol[]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    usuario?: UsuarioAutenticado;
  }
}

/**
 * Middleware central de sesion y RBAC (RN-001): valida la cookie firmada y,
 * en cada peticion, recarga rol y estado de la cuenta desde la base de datos
 * para que una cuenta desactivada pierda el acceso de inmediato.
 */
const sessionPlugin: FastifyPluginAsync<{ env: Env; usuarios: UsuariosRepository }> = async (fastify, opts) => {
  const { env, usuarios } = opts;

  fastify.decorate("requireAuth", (rolesPermitidos?: Rol[]) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const token = request.cookies[env.SESSION_COOKIE_NAME];
      if (!token) {
        return reply.unauthorized("No hay una sesion activa.");
      }

      const payload = verifySessionToken(env, token);
      if (!payload) {
        reply.clearCookie(env.SESSION_COOKIE_NAME, { path: "/" });
        return reply.unauthorized("La sesion no es valida o expiro.");
      }

      const usuario = await usuarios.buscarDatosDeSesion(payload.sub);

      if (!usuario || !usuario.activo) {
        reply.clearCookie(env.SESSION_COOKIE_NAME, { path: "/" });
        return reply.unauthorized("La cuenta no existe o esta desactivada.");
      }

      if (rolesPermitidos && rolesPermitidos.length > 0 && !rolesPermitidos.includes(usuario.rol as Rol)) {
        return reply.forbidden("Tu rol no tiene acceso a esta funcion.");
      }

      request.usuario = {
        id: usuario.id,
        correo: usuario.correo,
        nombre: usuario.nombre,
        rol: usuario.rol as Rol,
      };
    };
  });
};

export default fp(sessionPlugin, { name: "session" });

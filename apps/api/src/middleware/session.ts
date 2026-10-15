import fp from "fastify-plugin";
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import type { Rol } from "@portal-tutorias/shared";
import { noAutenticado } from "../lib/errors.js";
import type { TokensDeSesion } from "../modules/auth/auth.puertos.js";
import type { ConsultaDeSesion } from "../modules/usuarios/usuarios.puertos.js";
import type { CookieDeSesion } from "./cookie-de-sesion.js";

export interface UsuarioAutenticado {
  id: string;
  correo: string;
  nombre: string;
  rol: Rol;
}

export interface OpcionesDeSesion {
  cookie: CookieDeSesion;
  tokens: Pick<TokensDeSesion, "verificar">;
  usuarios: ConsultaDeSesion;
}

declare module "fastify" {
  interface FastifyInstance {
    requireAuth: (roles?: Rol[]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    usuario?: UsuarioAutenticado;
  }
}

const SIN_SESION = "No hay una sesión activa.";

/**
 * Usuario autenticado de la petición. Solo debe usarse en rutas protegidas con
 * `requireAuth`, que es quien lo asigna.
 *
 * @throws ErrorDeNegocio 401 si la ruta no exigió autenticación.
 */
export function usuarioDe(request: FastifyRequest): UsuarioAutenticado {
  if (!request.usuario) {
    throw noAutenticado(SIN_SESION);
  }
  return request.usuario;
}

/**
 * Sesión y control de acceso por rol (RN-001). `requireAuth(roles)` valida la
 * cookie firmada y, en cada petición, vuelve a leer el rol y el estado de la
 * cuenta en la base de datos: una cuenta desactivada pierde el acceso de
 * inmediato, aunque su cookie siga vigente.
 */
const sessionPlugin: FastifyPluginAsync<OpcionesDeSesion> = async (fastify, { cookie, tokens, usuarios }) => {
  fastify.decorate("requireAuth", (rolesPermitidos?: Rol[]) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const token = cookie.leer(request);
      if (!token) {
        return reply.unauthorized(SIN_SESION);
      }

      const usuarioId = tokens.verificar(token);
      if (!usuarioId) {
        cookie.borrar(reply);
        return reply.unauthorized("La sesión no es válida o expiró.");
      }

      const usuario = await usuarios.buscarDatosDeSesion(usuarioId);
      if (!usuario || !usuario.activo) {
        cookie.borrar(reply);
        return reply.unauthorized("La cuenta no existe o está desactivada.");
      }

      if (rolesPermitidos && rolesPermitidos.length > 0 && !rolesPermitidos.includes(usuario.rol)) {
        return reply.forbidden("Tu rol no tiene acceso a esta función.");
      }

      request.usuario = {
        id: usuario.id,
        correo: usuario.correo,
        nombre: usuario.nombre,
        rol: usuario.rol,
      };
    };
  });
};

export default fp(sessionPlugin, { name: "session" });

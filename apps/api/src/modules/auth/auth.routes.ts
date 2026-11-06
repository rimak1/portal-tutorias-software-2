import type { FastifyPluginAsync } from "fastify";
import {
  loginSchema,
  restablecerPasswordSchema,
  solicitarRecuperacionSchema,
} from "@portal-tutorias/shared";
import { ErrorDeNegocio } from "../../lib/errors.js";
import { validar } from "../../lib/validacion.js";
import type { CookieDeSesion } from "../../middleware/cookie-de-sesion.js";
import type { AuthService } from "./auth.service.js";
import { exigirDisponible, type LimitesDeAutenticacion } from "./limites-de-autenticacion.js";
import type { RecuperacionDePasswordService } from "./recuperacion-password.service.js";

export interface AuthRoutesOptions {
  cookie: CookieDeSesion;
  auth: AuthService;
  recuperacion: RecuperacionDePasswordService;
  limites: LimitesDeAutenticacion;
}

/**
 * RF-001 a RF-003: inicio y cierre de sesión, solicitud del enlace de
 * restablecimiento y definición de la nueva contraseña. Todas las rutas son
 * públicas excepto el cierre y la consulta de la sesión.
 */
const authRoutes: FastifyPluginAsync<AuthRoutesOptions> = async (fastify, { cookie, auth, recuperacion, limites }) => {
  fastify.post("/auth/login", async (request, reply) => {
    const { correo, password } = validar(loginSchema, request.body, "Correo y contraseña son obligatorios.");
    const ip = request.ip;
    const claveDeCuenta = `${ip}|${correo.toLowerCase()}`;
    exigirDisponible(limites.fallosDeLoginPorIp, ip);
    exigirDisponible(limites.fallosDeLoginPorCuenta, claveDeCuenta);

    let sesion;
    try {
      sesion = await auth.login(correo, password);
    } catch (error) {
      // Solo cuentan los intentos que fallan por credenciales: los correctos no agotan el límite.
      if (error instanceof ErrorDeNegocio && error.statusCode === 401) {
        limites.fallosDeLoginPorIp.registrar(ip);
        limites.fallosDeLoginPorCuenta.registrar(claveDeCuenta);
      }
      throw error;
    }
    limites.fallosDeLoginPorCuenta.reiniciar(claveDeCuenta);
    cookie.escribir(reply, sesion.token);
    return reply.send({ usuario: sesion.usuario });
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
    const ip = request.ip;
    exigirDisponible(limites.recuperacionPorIp, ip);
    limites.recuperacionPorIp.registrar(ip);

    // Pasado el límite de un correo se omite el envío pero la respuesta no cambia: así tampoco
    // se distingue un correo registrado de uno que no lo está.
    const claveDeCuenta = correo.toLowerCase();
    if (limites.recuperacionPorCuenta.esperaPara(claveDeCuenta) === 0) {
      limites.recuperacionPorCuenta.registrar(claveDeCuenta);
      await recuperacion.solicitar(correo);
    }
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

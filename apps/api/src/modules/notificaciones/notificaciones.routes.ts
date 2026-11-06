import type { FastifyPluginAsync } from "fastify";
import { exigirUuidDeRuta } from "../../lib/validacion.js";
import { usuarioDe } from "../../middleware/session.js";
import { MENSAJE_AVISO_INEXISTENTE, type NotificacionesService } from "./notificaciones.service.js";

/**
 * F-07: avisos del usuario autenticado, de cualquier rol. El identificador del
 * dueño sale siempre de la sesión, nunca de la petición.
 */
const notificacionesRoutes: FastifyPluginAsync<{ notificaciones: NotificacionesService }> = async (fastify, { notificaciones }) => {
  const autenticado = { preHandler: fastify.requireAuth() };

  fastify.get("/notificaciones", autenticado, async (request) => {
    return notificaciones.listar(usuarioDe(request).id);
  });

  fastify.post("/notificaciones/leer-todas", autenticado, async (request) => {
    await notificaciones.marcarTodasLeidas(usuarioDe(request).id);
    return { ok: true };
  });

  fastify.post<{ Params: { id: string } }>("/notificaciones/:id/leer", autenticado, async (request) => {
    const id = exigirUuidDeRuta(request.params.id, MENSAJE_AVISO_INEXISTENTE);
    await notificaciones.marcarLeida(usuarioDe(request).id, id);
    return { ok: true };
  });
};

export default notificacionesRoutes;

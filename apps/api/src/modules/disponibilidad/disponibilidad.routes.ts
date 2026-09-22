import type { FastifyPluginAsync } from "fastify";
import { DisponibilidadService } from "./disponibilidad.service.js";

/**
 * RF-004: consulta de disponibilidad de tutores. Solo lectura; la
 * publicacion de franjas por el tutor queda para una entrega posterior.
 */
const disponibilidadRoutes: FastifyPluginAsync = async (fastify) => {
  const service = new DisponibilidadService(fastify.prisma);

  fastify.get(
    "/disponibilidad",
    { preHandler: fastify.requireAuth() },
    async (_request, reply) => {
      const disponibilidades = await service.listarProximas();
      return reply.send({ disponibilidades });
    },
  );
};

export default disponibilidadRoutes;

import type { FastifyPluginAsync } from "fastify";
import { asociarMateriasSchema } from "@portal-tutorias/shared";
import { validar } from "../../lib/validacion.js";
import type { MateriasService } from "./materias.service.js";

/** SWR-20 (F-10): materias del catalogo y materias del perfil del tutor. */
const materiasRoutes: FastifyPluginAsync<{ materias: MateriasService }> = async (fastify, { materias: service }) => {
  fastify.get("/materias", { preHandler: fastify.requireAuth() }, async () => {
    return { materias: await service.listarCatalogo() };
  });

  fastify.get("/tutores/yo/materias", { preHandler: fastify.requireAuth(["TUTOR"]) }, async (request) => {
    return { materias: await service.listarDeTutor(request.usuario!.id) };
  });

  fastify.put("/tutores/yo/materias", { preHandler: fastify.requireAuth(["TUTOR"]) }, async (request) => {
    const { materiaIds } = validar(asociarMateriasSchema, request.body);
    return { materias: await service.reemplazarDeTutor(request.usuario!.id, materiaIds) };
  });
};

export default materiasRoutes;

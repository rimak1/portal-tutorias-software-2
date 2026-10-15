import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { actualizarFranjaSchema, crearFranjaSchema } from "@portal-tutorias/shared";
import { exigirUuidDeRuta, validar } from "../../lib/validacion.js";
import { usuarioDe } from "../../middleware/session.js";
import type { ConsultaDeDisponibilidadService } from "./consulta-disponibilidad.service.js";
import type { GestionDeFranjasService } from "./gestion-franjas.service.js";

const filtrosSchema = z.object({
  tutorId: z.string().uuid("El tutor indicado no es válido.").optional(),
  materiaId: z.string().uuid("La materia indicada no es válida.").optional(),
});

/**
 * F-02 y F-03: consulta de disponibilidad (cualquier usuario autenticado) y
 * gestión de franjas por el propio tutor (crear, modificar y eliminar).
 */
const disponibilidadRoutes: FastifyPluginAsync<{
  consulta: ConsultaDeDisponibilidadService;
  gestion: GestionDeFranjasService;
}> = async (fastify, { consulta, gestion }) => {
  const soloTutor = { preHandler: fastify.requireAuth(["TUTOR"]) };

  fastify.get("/disponibilidad", { preHandler: fastify.requireAuth() }, async (request) => {
    const filtros = validar(filtrosSchema, request.query);
    return { disponibilidades: await consulta.listarProximas(filtros) };
  });

  fastify.get("/disponibilidad/mias", soloTutor, async (request) => {
    return { franjas: await consulta.listarDeTutor(usuarioDe(request).id) };
  });

  fastify.post("/disponibilidad", soloTutor, async (request, reply) => {
    const entrada = validar(crearFranjaSchema, request.body);
    const franja = await gestion.crear(usuarioDe(request).id, entrada);
    return reply.code(201).send({ franja });
  });

  fastify.patch<{ Params: { id: string } }>("/disponibilidad/:id", soloTutor, async (request) => {
    const id = exigirUuidDeRuta(request.params.id, "La franja no existe.");
    const cambios = validar(actualizarFranjaSchema, request.body);
    return { franja: await gestion.actualizar(usuarioDe(request).id, id, cambios) };
  });

  fastify.delete<{ Params: { id: string } }>("/disponibilidad/:id", soloTutor, async (request, reply) => {
    const id = exigirUuidDeRuta(request.params.id, "La franja no existe.");
    await gestion.eliminar(usuarioDe(request).id, id);
    return reply.code(204).send();
  });
};

export default disponibilidadRoutes;

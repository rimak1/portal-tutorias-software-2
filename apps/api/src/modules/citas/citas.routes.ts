import type { FastifyPluginAsync } from "fastify";
import { rechazarCitaSchema, reprogramarCitaSchema, reservarCitaSchema } from "@portal-tutorias/shared";
import { exigirUuidDeRuta, validar } from "../../lib/validacion.js";
import type { CitasService } from "./citas.service.js";

/**
 * F-04, F-05, F-06 y F-11: reserva, atencion de solicitudes, ciclo de vida y
 * cancelacion de citas. Cada accion exige el rol que la ejecuta (RN-001).
 */
const citasRoutes: FastifyPluginAsync<{ citas: CitasService }> = async (fastify, { citas: service }) => {  const estudiante = { preHandler: fastify.requireAuth(["ESTUDIANTE"]) };
  const tutor = { preHandler: fastify.requireAuth(["TUTOR"]) };
  const idDeCita = (id: string) => exigirUuidDeRuta(id, "La cita no existe.");

  fastify.get("/citas", { preHandler: fastify.requireAuth(["ESTUDIANTE", "TUTOR"]) }, async (request) => {
    return { citas: await service.listar(request.usuario!) };
  });

  fastify.post("/citas", estudiante, async (request, reply) => {
    const { disponibilidadId } = validar(reservarCitaSchema, request.body);
    const cita = await service.reservar(request.usuario!.id, disponibilidadId);
    return reply.code(201).send({ cita });
  });

  fastify.post<{ Params: { id: string } }>("/citas/:id/aprobar", tutor, async (request) => {
    return { cita: await service.aprobar(request.usuario!.id, idDeCita(request.params.id)) };
  });

  fastify.post<{ Params: { id: string } }>("/citas/:id/rechazar", tutor, async (request) => {
    const id = idDeCita(request.params.id);
    const { motivo } = validar(rechazarCitaSchema, request.body);
    return { cita: await service.rechazar(request.usuario!.id, id, motivo) };
  });

  fastify.post<{ Params: { id: string } }>("/citas/:id/reprogramar", tutor, async (request) => {
    const id = idDeCita(request.params.id);
    const { disponibilidadId } = validar(reprogramarCitaSchema, request.body);
    return { cita: await service.reprogramar(request.usuario!.id, id, disponibilidadId) };
  });

  fastify.post<{ Params: { id: string } }>("/citas/:id/finalizar", tutor, async (request) => {
    return { cita: await service.finalizar(request.usuario!.id, idDeCita(request.params.id)) };
  });

  fastify.post<{ Params: { id: string } }>("/citas/:id/propuesta/aceptar", estudiante, async (request) => {
    return { cita: await service.aceptarPropuesta(request.usuario!.id, idDeCita(request.params.id)) };
  });

  fastify.post<{ Params: { id: string } }>("/citas/:id/propuesta/rechazar", estudiante, async (request) => {
    return { cita: await service.rechazarPropuesta(request.usuario!.id, idDeCita(request.params.id)) };
  });

  fastify.post<{ Params: { id: string } }>("/citas/:id/cancelar", estudiante, async (request) => {
    return { cita: await service.cancelar(request.usuario!.id, idDeCita(request.params.id)) };
  });
};

export default citasRoutes;

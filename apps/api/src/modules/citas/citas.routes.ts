import type { FastifyPluginAsync } from "fastify";
import { rechazarCitaSchema, reprogramarCitaSchema, reservarCitaSchema, type Cita } from "@portal-tutorias/shared";
import { exigirUuidDeRuta, validar } from "../../lib/validacion.js";
import type { CitasDelEstudianteService } from "./citas-del-estudiante.service.js";
import type { CitasDelTutorService } from "./citas-del-tutor.service.js";

/**
 * F-04, F-05, F-06 y F-11: reserva, atencion de solicitudes, ciclo de vida y
 * cancelacion de citas. Cada accion exige el rol que la ejecuta (RN-001) y se
 * delega en el servicio de ese actor.
 */
const citasRoutes: FastifyPluginAsync<{
  estudiante: CitasDelEstudianteService;
  tutor: CitasDelTutorService;
}> = async (fastify, { estudiante, tutor }) => {
  const comoEstudiante = { preHandler: fastify.requireAuth(["ESTUDIANTE"]) };
  const comoTutor = { preHandler: fastify.requireAuth(["TUTOR"]) };
  const idDeCita = (id: string) => exigirUuidDeRuta(id, "La cita no existe.");

  // Cada rol que participa en citas tiene su listado: agregar uno nuevo no exige condicionales.
  const listarPorRol: Record<"ESTUDIANTE" | "TUTOR", (usuarioId: string) => Promise<Cita[]>> = {
    ESTUDIANTE: (id) => estudiante.listar(id),
    TUTOR: (id) => tutor.listar(id),
  };

  fastify.get("/citas", { preHandler: fastify.requireAuth(["ESTUDIANTE", "TUTOR"]) }, async (request) => {
    const { id, rol } = request.usuario!;
    return { citas: await listarPorRol[rol as "ESTUDIANTE" | "TUTOR"](id) };
  });

  fastify.post("/citas", comoEstudiante, async (request, reply) => {
    const { disponibilidadId } = validar(reservarCitaSchema, request.body);
    const cita = await estudiante.reservar(request.usuario!.id, disponibilidadId);
    return reply.code(201).send({ cita });
  });

  fastify.post<{ Params: { id: string } }>("/citas/:id/aprobar", comoTutor, async (request) => {
    return { cita: await tutor.aprobar(request.usuario!.id, idDeCita(request.params.id)) };
  });

  fastify.post<{ Params: { id: string } }>("/citas/:id/rechazar", comoTutor, async (request) => {
    const id = idDeCita(request.params.id);
    const { motivo } = validar(rechazarCitaSchema, request.body);
    return { cita: await tutor.rechazar(request.usuario!.id, id, motivo) };
  });

  fastify.post<{ Params: { id: string } }>("/citas/:id/reprogramar", comoTutor, async (request) => {
    const id = idDeCita(request.params.id);
    const { disponibilidadId } = validar(reprogramarCitaSchema, request.body);
    return { cita: await tutor.reprogramar(request.usuario!.id, id, disponibilidadId) };
  });

  fastify.post<{ Params: { id: string } }>("/citas/:id/finalizar", comoTutor, async (request) => {
    return { cita: await tutor.finalizar(request.usuario!.id, idDeCita(request.params.id)) };
  });

  fastify.post<{ Params: { id: string } }>("/citas/:id/propuesta/aceptar", comoEstudiante, async (request) => {
    return { cita: await estudiante.aceptarPropuesta(request.usuario!.id, idDeCita(request.params.id)) };
  });

  fastify.post<{ Params: { id: string } }>("/citas/:id/propuesta/rechazar", comoEstudiante, async (request) => {
    return { cita: await estudiante.rechazarPropuesta(request.usuario!.id, idDeCita(request.params.id)) };
  });

  fastify.post<{ Params: { id: string } }>("/citas/:id/cancelar", comoEstudiante, async (request) => {
    return { cita: await estudiante.cancelar(request.usuario!.id, idDeCita(request.params.id)) };
  });
};

export default citasRoutes;

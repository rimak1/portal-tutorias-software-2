import type { FastifyPluginAsync } from "fastify";
import { rechazarCitaSchema, reprogramarCitaSchema, reservarCitaSchema, type Cita, type Rol } from "@portal-tutorias/shared";
import { ErrorDeNegocio } from "../../lib/errors.js";
import { exigirUuidDeRuta, validar } from "../../lib/validacion.js";
import { usuarioDe } from "../../middleware/session.js";
import type { CitasDelEstudianteService } from "./citas-del-estudiante.service.js";
import type { CitasDelTutorService } from "./citas-del-tutor.service.js";
import { MENSAJE_CITA_INEXISTENTE } from "./ejecutor-de-transiciones.js";

type RolEnCitas = "ESTUDIANTE" | "TUTOR";
const ROLES_EN_CITAS: RolEnCitas[] = ["ESTUDIANTE", "TUTOR"];

const participaEnCitas = (rol: Rol): rol is RolEnCitas => (ROLES_EN_CITAS as Rol[]).includes(rol);

type ParametrosDeCita = { Params: { id: string } };

/**
 * F-04, F-05, F-06 y F-11: reserva, atención de solicitudes, ciclo de vida y
 * cancelación de citas. Cada acción exige el rol que la ejecuta (RN-001) y se
 * delega en el servicio de ese rol.
 */
const citasRoutes: FastifyPluginAsync<{
  estudiante: CitasDelEstudianteService;
  tutor: CitasDelTutorService;
}> = async (fastify, { estudiante, tutor }) => {
  const comoEstudiante = { preHandler: fastify.requireAuth(["ESTUDIANTE"]) };
  const comoTutor = { preHandler: fastify.requireAuth(["TUTOR"]) };
  const idDeCita = (id: string) => exigirUuidDeRuta(id, MENSAJE_CITA_INEXISTENTE);

  const listarPorRol: Record<RolEnCitas, (usuarioId: string) => Promise<Cita[]>> = {
    ESTUDIANTE: (id) => estudiante.listar(id),
    TUTOR: (id) => tutor.listar(id),
  };

  fastify.get("/citas", { preHandler: fastify.requireAuth(ROLES_EN_CITAS) }, async (request) => {
    const { id, rol } = usuarioDe(request);
    if (!participaEnCitas(rol)) {
      throw new ErrorDeNegocio("Tu rol no tiene acceso a esta función.", 403);
    }
    return { citas: await listarPorRol[rol](id) };
  });

  fastify.post("/citas", comoEstudiante, async (request, reply) => {
    const { disponibilidadId } = validar(reservarCitaSchema, request.body);
    const cita = await estudiante.reservar(usuarioDe(request).id, disponibilidadId);
    return reply.code(201).send({ cita });
  });

  fastify.post<ParametrosDeCita>("/citas/:id/aprobar", comoTutor, async (request) => {
    return { cita: await tutor.aprobar(usuarioDe(request).id, idDeCita(request.params.id)) };
  });

  fastify.post<ParametrosDeCita>("/citas/:id/rechazar", comoTutor, async (request) => {
    const id = idDeCita(request.params.id);
    const { motivo } = validar(rechazarCitaSchema, request.body);
    return { cita: await tutor.rechazar(usuarioDe(request).id, id, motivo) };
  });

  fastify.post<ParametrosDeCita>("/citas/:id/reprogramar", comoTutor, async (request) => {
    const id = idDeCita(request.params.id);
    const { disponibilidadId } = validar(reprogramarCitaSchema, request.body);
    return { cita: await tutor.reprogramar(usuarioDe(request).id, id, disponibilidadId) };
  });

  fastify.post<ParametrosDeCita>("/citas/:id/finalizar", comoTutor, async (request) => {
    return { cita: await tutor.finalizar(usuarioDe(request).id, idDeCita(request.params.id)) };
  });

  fastify.post<ParametrosDeCita>("/citas/:id/propuesta/aceptar", comoEstudiante, async (request) => {
    return { cita: await estudiante.aceptarPropuesta(usuarioDe(request).id, idDeCita(request.params.id)) };
  });

  fastify.post<ParametrosDeCita>("/citas/:id/propuesta/rechazar", comoEstudiante, async (request) => {
    return { cita: await estudiante.rechazarPropuesta(usuarioDe(request).id, idDeCita(request.params.id)) };
  });

  fastify.post<ParametrosDeCita>("/citas/:id/cancelar", comoEstudiante, async (request) => {
    return { cita: await estudiante.cancelar(usuarioDe(request).id, idDeCita(request.params.id)) };
  });
};

export default citasRoutes;

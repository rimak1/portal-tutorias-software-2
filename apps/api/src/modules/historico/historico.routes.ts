import type { FastifyPluginAsync } from "fastify";
import { filtroDeHistoricoSchema, paginaDeHistoricoSchema } from "@portal-tutorias/shared";
import { exigirUuidDeRuta, validar } from "../../lib/validacion.js";
import { MENSAJE_CITA_INEXISTENTE, type HistoricoService } from "./historico.service.js";

const MENSAJE_FILTROS = "Los filtros del histórico no son válidos.";

/**
 * F-09: histórico y reportes de tutorías, de todos los usuarios, para el
 * coordinador académico y el administrador (RN-001).
 */
const historicoRoutes: FastifyPluginAsync<{ historico: HistoricoService }> = async (fastify, { historico }) => {
  const quienConsulta = { preHandler: fastify.requireAuth(["COORDINADOR", "ADMINISTRADOR"]) };

  fastify.get("/historico", quienConsulta, async (request) => {
    const filtro = validar(filtroDeHistoricoSchema, request.query, MENSAJE_FILTROS);
    const pagina = validar(paginaDeHistoricoSchema, request.query, MENSAJE_FILTROS);
    return historico.consultar(filtro, pagina);
  });

  fastify.get("/historico/exportar", quienConsulta, async (request, reply) => {
    const filtro = validar(filtroDeHistoricoSchema, request.query, MENSAJE_FILTROS);
    return reply
      .header("Content-Type", "text/csv; charset=utf-8")
      .header("Content-Disposition", 'attachment; filename="historico-tutorias.csv"')
      .send(await historico.exportarCsv(filtro));
  });

  fastify.get<{ Params: { id: string } }>("/historico/:id", quienConsulta, async (request) => {
    return historico.detalle(exigirUuidDeRuta(request.params.id, MENSAJE_CITA_INEXISTENTE));
  });
};

export default historicoRoutes;

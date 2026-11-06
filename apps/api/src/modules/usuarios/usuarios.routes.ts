import type { FastifyPluginAsync } from "fastify";
import { actualizarCuentaSchema, crearCuentaSchema, filtroDeCuentasSchema } from "@portal-tutorias/shared";
import { exigirUuidDeRuta, validar } from "../../lib/validacion.js";
import { usuarioDe } from "../../middleware/session.js";
import { MENSAJE_CUENTA_INEXISTENTE, type GestionDeCuentasService } from "./gestion-de-cuentas.service.js";

/**
 * F-08: administración de cuentas. El administrador gestiona todas; el
 * coordinador académico solo lista y registra tutores (la regla vive en el
 * servicio). Editar o desactivar es exclusivo del administrador.
 */
const usuariosRoutes: FastifyPluginAsync<{ cuentas: GestionDeCuentasService }> = async (fastify, { cuentas }) => {
  const quienAdministra = { preHandler: fastify.requireAuth(["ADMINISTRADOR", "COORDINADOR"]) };
  const soloAdministrador = { preHandler: fastify.requireAuth(["ADMINISTRADOR"]) };

  fastify.get("/usuarios", quienAdministra, async (request) => {
    const filtro = validar(filtroDeCuentasSchema, request.query, "Los filtros de búsqueda no son válidos.");
    return { cuentas: await cuentas.listar(usuarioDe(request), filtro) };
  });

  fastify.post("/usuarios", quienAdministra, async (request, reply) => {
    const datos = validar(crearCuentaSchema, request.body, "Los datos de la cuenta no son válidos.");
    return reply.code(201).send({ cuenta: await cuentas.crear(usuarioDe(request), datos) });
  });

  fastify.patch<{ Params: { id: string } }>("/usuarios/:id", soloAdministrador, async (request) => {
    const id = exigirUuidDeRuta(request.params.id, MENSAJE_CUENTA_INEXISTENTE);
    const cambios = validar(actualizarCuentaSchema, request.body, "Los cambios de la cuenta no son válidos.");
    return { cuenta: await cuentas.actualizar(usuarioDe(request), id, cambios) };
  });
};

export default usuariosRoutes;

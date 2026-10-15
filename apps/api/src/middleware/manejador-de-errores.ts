import { STATUS_CODES } from "node:http";
import type { FastifyError, FastifyInstance } from "fastify";
import { ErrorDeNegocio } from "../lib/errors.js";

const MENSAJE_INESPERADO = "Ocurrió un error inesperado. Intenta de nuevo más tarde.";

function codigoDe(error: FastifyError): number {
  if (error instanceof ErrorDeNegocio) {
    return error.statusCode;
  }
  const codigo = error.statusCode;
  return codigo !== undefined && codigo >= 400 && codigo < 500 ? codigo : 500;
}

/**
 * Traduce cualquier error lanzado por una ruta a la respuesta HTTP:
 * - ErrorDeNegocio y los errores 4xx de Fastify (p. ej. un JSON mal formado)
 *   responden su código y su mensaje.
 * - Cualquier otro error se registra completo y responde 500 con un mensaje
 *   genérico, para no exponer detalles internos (consultas, rutas, trazas).
 *
 * Debe registrarse antes que las rutas para que estas lo hereden.
 */
export function registrarManejadorDeErrores(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    const statusCode = codigoDe(error);
    if (statusCode >= 500) {
      request.log.error({ err: error }, "Error no controlado");
    }
    return reply.code(statusCode).send({
      statusCode,
      error: STATUS_CODES[statusCode],
      message: statusCode >= 500 ? MENSAJE_INESPERADO : error.message,
    });
  });
}

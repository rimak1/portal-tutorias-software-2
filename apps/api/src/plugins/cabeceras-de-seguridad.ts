import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";

/**
 * Cabeceras de seguridad de todas las respuestas de la API. La API solo sirve
 * JSON y CSV, nunca páginas: la política de contenido prohíbe cargar o incrustar
 * cualquier recurso, y `no-store` evita que un navegador o proxy guarde datos
 * de sesión o personales.
 */
const cabecerasDeSeguridad: FastifyPluginAsync<{ produccion: boolean }> = async (fastify, { produccion }) => {
  fastify.addHook("onSend", async (_request, reply) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "DENY");
    reply.header("Referrer-Policy", "no-referrer");
    reply.header("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
    reply.header("Cache-Control", "no-store");
    // Los navegadores ignoran HSTS sobre HTTP, pero en desarrollo se omite para no fijar HTTPS en localhost.
    if (produccion) {
      reply.header("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
    }
  });
};

export default fp(cabecerasDeSeguridad, { name: "cabeceras-de-seguridad" });

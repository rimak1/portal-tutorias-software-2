import Fastify, { type FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { conflicto } from "../src/lib/errors.js";
import { registrarManejadorDeErrores } from "../src/middleware/manejador-de-errores.js";

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify({ logger: false });
  registrarManejadorDeErrores(app);
  app.get("/negocio", async () => {
    throw conflicto("La franja ya fue reservada.");
  });
  app.get("/inesperado", async () => {
    throw new Error('relation "cita" does not exist');
  });
  app.post("/eco", async (request) => request.body);
  await app.ready();
});

afterAll(() => app.close());

describe("manejador central de errores", () => {
  it("responde un ErrorDeNegocio con su código y su mensaje", async () => {
    const respuesta = await app.inject({ method: "GET", url: "/negocio" });

    expect(respuesta.statusCode).toBe(409);
    expect(respuesta.json()).toEqual({ statusCode: 409, error: "Conflict", message: "La franja ya fue reservada." });
  });

  it("un error inesperado responde 500 sin exponer su mensaje interno", async () => {
    const respuesta = await app.inject({ method: "GET", url: "/inesperado" });

    expect(respuesta.statusCode).toBe(500);
    expect(respuesta.json().message).not.toContain("relation");
  });

  it("conserva los errores 4xx de Fastify, como un JSON mal formado", async () => {
    const respuesta = await app.inject({
      method: "POST",
      url: "/eco",
      headers: { "content-type": "application/json" },
      payload: "{no es json",
    });

    expect(respuesta.statusCode).toBe(400);
  });
});

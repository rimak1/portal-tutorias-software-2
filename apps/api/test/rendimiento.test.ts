import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { crearUsuario, env, iniciarSesion, limpiar, prisma } from "./helpers.js";

const P = "ren";
const LIMITE_MS = 3000;
const USUARIOS_CONCURRENTES = 50;
const FRANJAS_PUBLICADAS = 3000;
const FRANJAS_DEL_TUTOR_CONSULTADO = 100;

let app: FastifyInstance;
let cookies: Record<string, string>;
let tutorId: string;
let materiaIdConsultada: string;

beforeAll(async () => {
  app = await buildApp(env);
  await app.ready();
  await limpiar(P);

  const estudiante = await crearUsuario(P, "Estudiante", "ESTUDIANTE");
  const tutor = await crearUsuario(P, "Tutor", "TUTOR");
  tutorId = tutor.id;
  const materia = await prisma.materia.create({ data: { nombre: `${P} Materia` } });
  const materiaDelTutor = await prisma.materia.create({ data: { nombre: `${P} Materia Del Tutor` } });
  materiaIdConsultada = materiaDelTutor.id;

  // El grueso de la oferta esta repartido; el tutor consultado tiene una agenda de tamano realista.
  const base = Date.now() + 7 * 24 * 60 * 60 * 1000;
  await prisma.disponibilidad.createMany({
    data: Array.from({ length: FRANJAS_PUBLICADAS }, (_, i) => ({
      tutorId,
      materiaId: i < FRANJAS_DEL_TUTOR_CONSULTADO ? materiaDelTutor.id : materia.id,
      fechaInicio: new Date(base + i * 60 * 60 * 1000),
      fechaFin: new Date(base + i * 60 * 60 * 1000 + 30 * 60 * 1000),
    })),
  });

  cookies = await iniciarSesion(app, estudiante.correo);
}, 60000);

afterAll(async () => {
  await limpiar(P);
  await prisma.$disconnect();
  await app.close();
});

describe("SWR-24: mostrar la disponibilidad en un maximo de 3 segundos", () => {
  it(`responde en menos de ${LIMITE_MS} ms con ${FRANJAS_PUBLICADAS} franjas publicadas`, async () => {
    const inicio = performance.now();
    const respuesta = await app.inject({ method: "GET", url: "/api/disponibilidad", cookies });
    const duracion = performance.now() - inicio;

    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json().disponibilidades.length).toBeGreaterThanOrEqual(FRANJAS_PUBLICADAS);
    expect(duracion).toBeLessThan(LIMITE_MS);
  });

  it(`con ${USUARIOS_CONCURRENTES} usuarios consultando a un tutor a la vez, ninguna respuesta supera ${LIMITE_MS} ms`, async () => {
    const duraciones = await Promise.all(
      Array.from({ length: USUARIOS_CONCURRENTES }, async () => {
        const inicio = performance.now();
        const respuesta = await app.inject({
          method: "GET",
          url: `/api/disponibilidad?tutorId=${tutorId}&materiaId=${materiaIdConsultada}`,
          cookies,
        });
        expect(respuesta.statusCode).toBe(200);
        expect(respuesta.json().disponibilidades).toHaveLength(FRANJAS_DEL_TUTOR_CONSULTADO);
        return performance.now() - inicio;
      }),
    );

    expect(Math.max(...duraciones)).toBeLessThan(LIMITE_MS);
  });
});

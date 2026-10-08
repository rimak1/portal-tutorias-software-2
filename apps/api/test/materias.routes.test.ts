import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { crearFranja, crearUsuario, enHoras, env, iniciarSesion, limpiar, prisma } from "./helpers.js";

const P = "mat";
let app: FastifyInstance;
let tutorId: string;
let cookiesTutor: Record<string, string>;
let cookiesEstudiante: Record<string, string>;
let algebra: { id: string };
let calculo: { id: string };
let fisica: { id: string };

beforeAll(async () => {
  app = await buildApp(env);
  await app.ready();
  await limpiar(P);

  const tutor = await crearUsuario(P, "Tutor", "TUTOR");
  const estudiante = await crearUsuario(P, "Estudiante", "ESTUDIANTE");
  tutorId = tutor.id;
  algebra = await prisma.materia.create({ data: { nombre: `${P} Álgebra` } });
  calculo = await prisma.materia.create({ data: { nombre: `${P} Cálculo` } });
  fisica = await prisma.materia.create({ data: { nombre: `${P} Física` } });

  cookiesTutor = await iniciarSesion(app, tutor.correo);
  cookiesEstudiante = await iniciarSesion(app, estudiante.correo);
});

afterAll(async () => {
  await limpiar(P);
  await prisma.$disconnect();
  await app.close();
});

const guardar = (cookies: Record<string, string>, materiaIds: string[]) =>
  app.inject({ method: "PUT", url: "/api/tutores/yo/materias", cookies, payload: { materiaIds } });

describe("SWR-20: asociar una o mas materias al perfil de un tutor", () => {
  it("el catalogo de materias esta disponible para cualquier usuario autenticado", async () => {
    const response = await app.inject({ method: "GET", url: "/api/materias", cookies: cookiesEstudiante });
    expect(response.statusCode).toBe(200);
    const nombres = response.json().materias.map((m: { nombre: string }) => m.nombre);
    expect(nombres).toContain(`${P} Álgebra`);

    const sinSesion = await app.inject({ method: "GET", url: "/api/materias" });
    expect(sinSesion.statusCode).toBe(401);
  });

  it("registra varias materias y quedan asociadas a la cuenta del tutor", async () => {
    const response = await guardar(cookiesTutor, [algebra.id, calculo.id]);

    expect(response.statusCode).toBe(200);
    const enBase = await prisma.tutorMateria.findMany({ where: { tutorId } });
    expect(enBase.map((a) => a.materiaId).sort()).toEqual([algebra.id, calculo.id].sort());

    const consulta = await app.inject({ method: "GET", url: "/api/tutores/yo/materias", cookies: cookiesTutor });
    expect(consulta.json().materias.map((m: { id: string }) => m.id).sort()).toEqual([algebra.id, calculo.id].sort());
  });

  it("actualizar reemplaza el conjunto anterior y tolera ids repetidos", async () => {
    const response = await guardar(cookiesTutor, [fisica.id, fisica.id]);

    expect(response.statusCode).toBe(200);
    const enBase = await prisma.tutorMateria.findMany({ where: { tutorId } });
    expect(enBase.map((a) => a.materiaId)).toEqual([fisica.id]);
  });

  it("exige al menos una materia", async () => {
    const response = await guardar(cookiesTutor, []);
    expect(response.statusCode).toBe(400);
  });

  it("rechaza una materia que no existe en el catalogo", async () => {
    const response = await guardar(cookiesTutor, ["00000000-0000-4000-8000-000000000000"]);
    expect(response.statusCode).toBe(400);
  });

  it("no permite quitar una materia con franjas vigentes publicadas", async () => {
    await guardar(cookiesTutor, [algebra.id, fisica.id]);
    await crearFranja(tutorId, algebra.id, enHoras(48), enHoras(49));

    const response = await guardar(cookiesTutor, [fisica.id]);

    expect(response.statusCode).toBe(409);
    expect(response.json().message).toContain("franjas vigentes");
    const enBase = await prisma.tutorMateria.findMany({ where: { tutorId } });
    expect(enBase.map((a) => a.materiaId).sort()).toEqual([algebra.id, fisica.id].sort());
  });

  it("solo un tutor puede editar su perfil de materias (RN-001)", async () => {
    const response = await guardar(cookiesEstudiante, [algebra.id]);
    expect(response.statusCode).toBe(403);
  });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { crearFranja, crearUsuario, enHoras, env, iniciarSesion, limpiar, prisma } from "./helpers.js";

/**
 * Pruebas de integracion contra una base de datos PostgreSQL real (ver
 * auth.routes.test.ts). Requiere DATABASE_URL con las migraciones aplicadas.
 */

const P = "disp";
let app: FastifyInstance;
let cookiesEstudiante: Record<string, string>;
let tutorActivo: { id: string };
let tutorOtro: { id: string };
let materiaVigente: { id: string };
let materiaOtra: { id: string };

beforeAll(async () => {
  app = await buildApp(env);
  await app.ready();
  await limpiar(P);

  const estudiante = await crearUsuario(P, "Estudiante Test", "ESTUDIANTE");
  tutorActivo = await crearUsuario(P, "Tutor Activo Test", "TUTOR");
  tutorOtro = await crearUsuario(P, "Tutor Otro Test", "TUTOR");
  const tutorInactivo = await crearUsuario(P, "Tutor Inactivo Test", "TUTOR", false);

  materiaVigente = await prisma.materia.create({ data: { nombre: `${P} Materia Prueba Vigente` } });
  materiaOtra = await prisma.materia.create({ data: { nombre: `${P} Materia Prueba Otra` } });
  const materiaInactivo = await prisma.materia.create({ data: { nombre: `${P} Materia Prueba Tutor Inactivo` } });

  // Futura, de un tutor activo: debe aparecer.
  await crearFranja(tutorActivo.id, materiaVigente.id, enHoras(48), enHoras(49));
  // Posterior en el tiempo, de la misma materia: define el orden esperado.
  await crearFranja(tutorActivo.id, materiaVigente.id, enHoras(72), enHoras(73));
  // Pasada: no debe aparecer.
  await crearFranja(tutorActivo.id, materiaVigente.id, enHoras(-5), enHoras(-4));
  // Futura, pero de un tutor inactivo: no debe aparecer.
  await crearFranja(tutorInactivo.id, materiaInactivo.id, enHoras(24), enHoras(25));
  // Futura, pero ya reservada: no debe aparecer (RN-004).
  await crearFranja(tutorActivo.id, materiaVigente.id, enHoras(96), enHoras(97), "RESERVADA");
  // Otro tutor y otra materia: sirve para comprobar los filtros.
  await crearFranja(tutorOtro.id, materiaOtra.id, enHoras(50), enHoras(51));
  // Futura pero eliminada: no debe aparecer (SWR-05).
  const eliminada = await crearFranja(tutorOtro.id, materiaOtra.id, enHoras(120), enHoras(121));
  await prisma.disponibilidad.update({ where: { id: eliminada.id }, data: { eliminadaEn: new Date() } });

  cookiesEstudiante = await iniciarSesion(app, estudiante.correo);
});

afterAll(async () => {
  await limpiar(P);
  await prisma.$disconnect();
  await app.close();
});

const consultar = async (query = "") => {
  const response = await app.inject({ method: "GET", url: `/api/disponibilidad${query}`, cookies: cookiesEstudiante });
  return { response, lista: response.json().disponibilidades as Array<{ materia: string; materiaId: string; fechaInicio: string; tutor: { id: string; nombre: string } }> };
};

describe("GET /api/disponibilidad (RF-004)", () => {
  it("rechaza la peticion sin sesion activa", async () => {
    const response = await app.inject({ method: "GET", url: "/api/disponibilidad" });
    expect(response.statusCode).toBe(401);
  });

  it("devuelve solo franjas futuras de tutores activos, ordenadas por fecha", async () => {
    const { response, lista } = await consultar();

    expect(response.statusCode).toBe(200);

    const materias = lista.map((d) => d.materia);
    expect(materias).toContain(`${P} Materia Prueba Vigente`);
    expect(materias).not.toContain(`${P} Materia Prueba Tutor Inactivo`);

    const fechas = lista.map((d) => new Date(d.fechaInicio).getTime());
    expect(fechas).toEqual([...fechas].sort((a, b) => a - b));

    const franjaCreada = lista.find((d) => d.materia === `${P} Materia Prueba Vigente`)!;
    expect(franjaCreada.tutor.nombre).toBe("Tutor Activo Test");
  });
});

describe("SWR-06: franjas de un tutor ordenadas por fecha y hora", () => {
  it("lista solo las franjas libres y vigentes del tutor pedido, de la mas proxima a la mas lejana", async () => {
    const { lista } = await consultar(`?tutorId=${tutorActivo.id}`);

    expect(lista.every((d) => d.tutor.id === tutorActivo.id)).toBe(true);
    // Vigentes y libres: la de +48h y la de +72h. Quedan fuera la pasada y la reservada.
    expect(lista.map((d) => d.materia)).toEqual([`${P} Materia Prueba Vigente`, `${P} Materia Prueba Vigente`]);
    const fechas = lista.map((d) => new Date(d.fechaInicio).getTime());
    expect(fechas).toEqual([...fechas].sort((a, b) => a - b));
  });

  it("no lista franjas reservadas ni eliminadas", async () => {
    const { lista } = await consultar();
    const idsOtroTutor = lista.filter((d) => d.tutor.id === tutorOtro.id);
    expect(idsOtroTutor).toHaveLength(1);
    expect(lista.filter((d) => d.tutor.id === tutorActivo.id)).toHaveLength(2);
  });
});

describe("SWR-07: filtrar la disponibilidad por materia", () => {
  it("el servidor devuelve solo los tutores de la materia pedida", async () => {
    const { lista } = await consultar(`?materiaId=${materiaOtra.id}`);

    expect(lista.length).toBeGreaterThan(0);
    expect(lista.every((d) => d.materiaId === materiaOtra.id)).toBe(true);
    expect(lista.every((d) => d.tutor.id === tutorOtro.id)).toBe(true);
  });

  it("una materia sin franjas devuelve una lista vacia", async () => {
    const sinFranjas = await prisma.materia.create({ data: { nombre: `${P} Materia Sin Franjas` } });
    const { lista } = await consultar(`?materiaId=${sinFranjas.id}`);
    expect(lista).toEqual([]);
  });

  it("un identificador de materia invalido se rechaza con 400", async () => {
    const { response } = await consultar("?materiaId=no-es-un-uuid");
    expect(response.statusCode).toBe(400);
  });
});

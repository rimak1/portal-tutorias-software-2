import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { crearFranja, crearUsuario, env, iniciarSesion, limpiar, prisma } from "./helpers.js";

/**
 * F-07 (SWR-15). Pruebas de integración contra PostgreSQL real: los avisos se
 * generan al ejecutar las acciones de las citas por HTTP y se consultan por la API.
 */

const P = "not";
const T0 = Date.now();
const instante = (horas: number) => new Date(T0 + horas * 60 * 60 * 1000);

type Cookies = Record<string, string>;
interface Aviso {
  id: string;
  titulo: string;
  texto: string;
  citaId: string | null;
  leida: boolean;
}

let app: FastifyInstance;
let tutor: { id: string };
let estudiante: { id: string };
let materia: { id: string };
let cookiesTutor: Cookies;
let cookiesEstudiante: Cookies;
let cookiesOtroEstudiante: Cookies;
let cookiesCoordinador: Cookies;

beforeAll(async () => {
  app = await buildApp(env);
  await app.ready();
  await limpiar(P);

  const usuarioTutor = await crearUsuario(P, "Tutor", "TUTOR");
  const usuarioEstudiante = await crearUsuario(P, "Estudiante", "ESTUDIANTE");
  const otroEstudiante = await crearUsuario(P, "Otro Estudiante", "ESTUDIANTE");
  const coordinador = await crearUsuario(P, "Coordinador", "COORDINADOR");
  tutor = usuarioTutor;
  estudiante = usuarioEstudiante;
  materia = await prisma.materia.create({ data: { nombre: `${P} Materia` } });
  await prisma.tutorMateria.create({ data: { tutorId: tutor.id, materiaId: materia.id } });

  cookiesTutor = await iniciarSesion(app, usuarioTutor.correo);
  cookiesEstudiante = await iniciarSesion(app, usuarioEstudiante.correo);
  cookiesOtroEstudiante = await iniciarSesion(app, otroEstudiante.correo);
  cookiesCoordinador = await iniciarSesion(app, coordinador.correo);
});

afterAll(async () => {
  await limpiar(P);
  await prisma.$disconnect();
  await app.close();
});

const post = (cookies: Cookies, url: string, payload: object = {}) => app.inject({ method: "POST", url, cookies, payload });
const franjaFutura = (horas: number) => crearFranja(tutor.id, materia.id, instante(horas), instante(horas + 1));

async function avisos(cookies: Cookies) {
  const respuesta = await app.inject({ method: "GET", url: "/api/notificaciones", cookies });
  expect(respuesta.statusCode).toBe(200);
  return respuesta.json() as { notificaciones: Aviso[]; noLeidas: number };
}

/** Los avisos de una cita concreta, para que las pruebas no dependan de lo que dejaron las anteriores. */
const deLaCita = (lista: Aviso[], citaId: string) => lista.filter((a) => a.citaId === citaId).map((a) => a.titulo);

async function reservar(horas: number) {
  const franja = await franjaFutura(horas);
  const respuesta = await post(cookiesEstudiante, "/api/citas", { disponibilidadId: franja.id });
  expect(respuesta.statusCode).toBe(201);
  return { franja, citaId: respuesta.json().cita.id as string };
}

describe("F-07: los cambios de una cita generan avisos para la otra parte", () => {
  it("reservar avisa al tutor y no al estudiante que reservó", async () => {
    const { citaId } = await reservar(100);

    expect(deLaCita((await avisos(cookiesTutor)).notificaciones, citaId)).toEqual(["Nueva solicitud de tutoría"]);
    expect(deLaCita((await avisos(cookiesEstudiante)).notificaciones, citaId)).toEqual([]);
  });

  it("aprobar y rechazar avisan al estudiante; el rechazo incluye el motivo", async () => {
    const aprobada = await reservar(101);
    await post(cookiesTutor, `/api/citas/${aprobada.citaId}/aprobar`);
    const rechazada = await reservar(102);
    await post(cookiesTutor, `/api/citas/${rechazada.citaId}/rechazar`, { motivo: "Ese día no atiendo" });

    const { notificaciones } = await avisos(cookiesEstudiante);

    expect(deLaCita(notificaciones, aprobada.citaId)).toEqual(["Tu tutoría fue aprobada"]);
    expect(deLaCita(notificaciones, rechazada.citaId)).toEqual(["Tu solicitud fue rechazada"]);
    expect(notificaciones.find((a) => a.citaId === rechazada.citaId)?.texto).toContain("Ese día no atiendo");
  });

  it("proponer otro horario avisa al estudiante y aceptarlo avisa al tutor", async () => {
    const { citaId } = await reservar(103);
    const nueva = await franjaFutura(104);
    await post(cookiesTutor, `/api/citas/${citaId}/reprogramar`, { disponibilidadId: nueva.id });
    await post(cookiesEstudiante, `/api/citas/${citaId}/propuesta/aceptar`);

    expect(deLaCita((await avisos(cookiesEstudiante)).notificaciones, citaId)).toEqual(["Propuesta de reprogramación"]);
    expect(deLaCita((await avisos(cookiesTutor)).notificaciones, citaId).sort()).toEqual(["Nueva solicitud de tutoría", "Reprogramación aceptada"]);
  });

  it("cancelar avisa al tutor", async () => {
    const { citaId } = await reservar(105);
    await post(cookiesEstudiante, `/api/citas/${citaId}/cancelar`);

    expect(deLaCita((await avisos(cookiesTutor)).notificaciones, citaId)).toContain("Tutoría cancelada");
  });

  it("una acción que falla no genera avisos", async () => {
    const { citaId } = await reservar(106);
    const antes = (await avisos(cookiesEstudiante)).notificaciones.length;

    const respuesta = await post(cookiesTutor, `/api/citas/${citaId}/rechazar`, { motivo: "   " });

    expect(respuesta.statusCode).toBe(400);
    expect((await avisos(cookiesEstudiante)).notificaciones).toHaveLength(antes);
  });
});

describe("GET /api/notificaciones", () => {
  it("exige sesión, pero cualquier rol puede consultar los suyos", async () => {
    expect((await app.inject({ method: "GET", url: "/api/notificaciones" })).statusCode).toBe(401);
    expect((await avisos(cookiesCoordinador)).notificaciones).toEqual([]);
  });

  it("cada usuario ve solo sus avisos, del más reciente al más antiguo", async () => {
    const { citaId } = await reservar(107);
    const delTutor = await avisos(cookiesTutor);
    const deOtro = await avisos(cookiesOtroEstudiante);

    expect(delTutor.notificaciones[0].citaId).toBe(citaId);
    expect(deOtro.notificaciones).toEqual([]);
    expect(deOtro.noLeidas).toBe(0);
  });
});

describe("marcar como leídas", () => {
  it("marca un aviso como leído y baja el contador", async () => {
    await reservar(108);
    const antes = await avisos(cookiesTutor);
    const [primero] = antes.notificaciones;
    expect(primero.leida).toBe(false);

    const respuesta = await post(cookiesTutor, `/api/notificaciones/${primero.id}/leer`);
    const repetida = await post(cookiesTutor, `/api/notificaciones/${primero.id}/leer`);

    expect(respuesta.statusCode).toBe(200);
    expect(repetida.statusCode).toBe(200);
    const despues = await avisos(cookiesTutor);
    expect(despues.noLeidas).toBe(antes.noLeidas - 1);
    expect(despues.notificaciones.find((a) => a.id === primero.id)?.leida).toBe(true);
  });

  it("no se puede marcar el aviso de otro usuario (404, y el aviso sigue sin leer)", async () => {
    const [delTutor] = (await avisos(cookiesTutor)).notificaciones.filter((a) => !a.leida);
    expect(delTutor).toBeDefined();

    const respuesta = await post(cookiesEstudiante, `/api/notificaciones/${delTutor.id}/leer`);

    expect(respuesta.statusCode).toBe(404);
    const enBase = await prisma.notificacion.findUniqueOrThrow({ where: { id: delTutor.id } });
    expect(enBase.leidaEn).toBeNull();
  });

  it("un identificador mal formado o inexistente es un 404", async () => {
    expect((await post(cookiesTutor, "/api/notificaciones/no-es-uuid/leer")).statusCode).toBe(404);
    expect((await post(cookiesTutor, "/api/notificaciones/00000000-0000-4000-8000-000000000000/leer")).statusCode).toBe(404);
  });

  it("marcar todas deja en cero solo los avisos de quien lo pide", async () => {
    await reservar(109);
    const delEstudianteAntes = (await avisos(cookiesEstudiante)).noLeidas;
    expect((await avisos(cookiesTutor)).noLeidas).toBeGreaterThan(0);

    const respuesta = await post(cookiesTutor, "/api/notificaciones/leer-todas");

    expect(respuesta.statusCode).toBe(200);
    expect((await avisos(cookiesTutor)).noLeidas).toBe(0);
    expect((await avisos(cookiesEstudiante)).noLeidas).toBe(delEstudianteAntes);
  });

  it("exigen sesión", async () => {
    expect((await app.inject({ method: "POST", url: "/api/notificaciones/leer-todas", payload: {} })).statusCode).toBe(401);
    expect((await app.inject({ method: "POST", url: `/api/notificaciones/${estudiante.id}/leer`, payload: {} })).statusCode).toBe(401);
  });
});
